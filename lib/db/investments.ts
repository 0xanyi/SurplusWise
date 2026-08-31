import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { investments, investmentEvents } from "@/db/schema";
import {
  idSchema,
  investmentCreateSchema,
  investmentUpdateSchema,
  investmentEventCreateSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";

// ─── Types ───────────────────────────────────────────────────────────────────

type InvestmentType = "stock" | "crypto" | "forex" | "property" | "business" | "savings" | "other";
type InvestmentEventType = "return" | "dividend" | "sale" | "partial_sale" | "loss" | "fee";

export interface CreateInput {
  name: string;
  investmentType: InvestmentType;
  platform?: string | null;
  costBasis: number;
  currentValue: number;
  quantity?: number | null;
  purchaseDate: string;
  notes?: string | null;
}

export interface UpdateInput {
  name?: string;
  investmentType?: InvestmentType;
  platform?: string | null;
  costBasis?: number;
  currentValue?: number;
  quantity?: number | null;
  purchaseDate?: string;
  notes?: string | null;
  isActive?: boolean;
}

export interface EventInput {
  eventType: InvestmentEventType;
  amount: number;
  eventDate: string;
  notes?: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

async function getOwnedInvestment(workspaceId: string, investmentId: string) {
  const [investment] = await db
    .select()
    .from(investments)
    .where(and(eq(investments.id, investmentId), eq(investments.workspaceId, workspaceId)))
    .limit(1);

  if (!investment) throw new Error("Investment not found or unauthorized");
  return investment;
}

// ─── Investment Service ──────────────────────────────────────────────────────

/** List all investments for a workspace, optionally only active ones. */
export async function list(workspaceId: string, isActive?: boolean) {
  workspaceIdSchema.parse(workspaceId);
  const conditions = [eq(investments.workspaceId, workspaceId)];
  if (isActive !== undefined) conditions.push(eq(investments.isActive, isActive));

  return db
    .select()
    .from(investments)
    .where(and(...conditions))
    .orderBy(investments.name);
}

/** Get summary totals for active investments. */
export async function getSummary(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);

  const [result] = await db
    .select({
      totalCostBasis: sql<string>`coalesce(sum(${investments.costBasis}), 0)`,
      totalCurrentValue: sql<string>`coalesce(sum(${investments.currentValue}), 0)`,
      totalGainLoss: sql<string>`coalesce(sum(${investments.currentValue} - ${investments.costBasis}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(investments)
    .where(
      and(
        eq(investments.workspaceId, workspaceId),
        eq(investments.isActive, true),
      ),
    );

  return {
    totalCostBasis: Number(result.totalCostBasis),
    totalCurrentValue: Number(result.totalCurrentValue),
    totalGainLoss: Number(result.totalGainLoss),
    count: result.count,
  };
}

/** Create a new investment record. */
export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  investmentCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const id = genId();
  const now = new Date();

  const [row] = await db
    .insert(investments)
    .values({
      id,
      userId,
      workspaceId,
      name: input.name,
      investmentType: input.investmentType,
      platform: input.platform ?? null,
      costBasis: String(input.costBasis),
      currentValue: String(input.currentValue),
      quantity: input.quantity != null ? String(input.quantity) : null,
      purchaseDate: input.purchaseDate,
      notes: input.notes ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return row;
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(workspaceId: string, id: string, input: UpdateInput) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  investmentUpdateSchema.parse(input);

  await getOwnedInvestment(workspaceId, id);

  const [row] = await db
    .update(investments)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.investmentType !== undefined && { investmentType: input.investmentType }),
      ...(input.platform !== undefined && { platform: input.platform }),
      ...(input.costBasis !== undefined && { costBasis: String(input.costBasis) }),
      ...(input.currentValue !== undefined && { currentValue: String(input.currentValue) }),
      ...(input.quantity !== undefined && { quantity: input.quantity != null ? String(input.quantity) : null }),
      ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      updatedAt: new Date(),
    })
    .where(and(eq(investments.id, id), eq(investments.workspaceId, workspaceId)))
    .returning();
  return row;
}

/** Delete an investment record (cascades to events). */
export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);

  await getOwnedInvestment(workspaceId, id);

  await db
    .delete(investments)
    .where(and(eq(investments.id, id), eq(investments.workspaceId, workspaceId)));
}

// ─── Investment Event Service ────────────────────────────────────────────────

/** List events for an investment, newest first. */
export async function listEvents(workspaceId: string, investmentId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(investmentId);

  await getOwnedInvestment(workspaceId, investmentId);

  return db
    .select()
    .from(investmentEvents)
    .where(eq(investmentEvents.investmentId, investmentId))
    .orderBy(desc(investmentEvents.eventDate), desc(investmentEvents.createdAt));
}

/** Add an event and adjust the investment's currentValue accordingly. */
export async function addEvent(
  workspaceId: string,
  investmentId: string,
  input: EventInput,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(investmentId);
  investmentEventCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);

  const investment = await getOwnedInvestment(workspaceId, investmentId);

  const eventId = genId();
  const now = new Date();
  const currentVal = Number(investment.currentValue);

  const event = await db.transaction(async (tx) => {
    // Insert the event
    const [inserted] = await tx
      .insert(investmentEvents)
      .values({
        id: eventId,
        investmentId,
        userId,
        eventType: input.eventType,
        amount: String(input.amount),
        eventDate: input.eventDate,
        notes: input.notes ?? null,
        createdAt: now,
      })
      .returning();

    // Adjust investment based on event type
    let newCurrentValue: number;
    let newIsActive: boolean | undefined;

    switch (input.eventType) {
      case "sale":
        newCurrentValue = 0;
        newIsActive = false;
        break;
      case "partial_sale":
        newCurrentValue = Math.max(0, currentVal - input.amount);
        break;
      case "return":
      case "dividend":
        newCurrentValue = currentVal + input.amount;
        break;
      case "loss":
      case "fee":
        newCurrentValue = Math.max(0, currentVal - input.amount);
        break;
      default:
        newCurrentValue = currentVal;
    }

    const updateData: Record<string, unknown> = {
      currentValue: String(newCurrentValue),
      updatedAt: now,
    };
    if (newIsActive !== undefined) {
      updateData.isActive = newIsActive;
    }

    await tx
      .update(investments)
      .set(updateData)
      .where(and(eq(investments.id, investmentId), eq(investments.workspaceId, workspaceId)));

    return inserted;
  });

  return event;
}

/** Delete an event and recalculate the investment's currentValue. */
export async function removeEvent(
  workspaceId: string,
  investmentId: string,
  eventId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(investmentId);
  idSchema.parse(eventId);

  await getOwnedInvestment(workspaceId, investmentId);

  const [existing] = await db
    .select({ id: investmentEvents.id, investmentId: investmentEvents.investmentId })
    .from(investmentEvents)
    .where(
      and(
        eq(investmentEvents.id, eventId),
        eq(investmentEvents.investmentId, investmentId),
      ),
    )
    .limit(1);

  if (!existing) throw new Error("Investment event not found or unauthorized");

  await db.transaction(async (tx) => {
    // Delete the event
    await tx
      .delete(investmentEvents)
      .where(
        and(
          eq(investmentEvents.id, eventId),
          eq(investmentEvents.investmentId, investmentId),
        ),
      );

    // Get the investment's costBasis
    const [investment] = await tx
      .select({ costBasis: investments.costBasis })
      .from(investments)
      .where(and(eq(investments.id, investmentId), eq(investments.workspaceId, workspaceId)))
      .limit(1);

    if (!investment) throw new Error("Investment not found or unauthorized");

    // Recalculate currentValue from costBasis + sum of returns/dividends - sum of sales/partial_sales/losses/fees
    const [gains] = await tx
      .select({
        total: sql<string>`coalesce(sum(${investmentEvents.amount}), 0)`,
      })
      .from(investmentEvents)
      .where(
        and(
          eq(investmentEvents.investmentId, investmentId),
          sql`${investmentEvents.eventType} in ('return', 'dividend')`,
        ),
      );

    const [deductions] = await tx
      .select({
        total: sql<string>`coalesce(sum(${investmentEvents.amount}), 0)`,
      })
      .from(investmentEvents)
      .where(
        and(
          eq(investmentEvents.investmentId, investmentId),
          sql`${investmentEvents.eventType} in ('sale', 'partial_sale', 'loss', 'fee')`,
        ),
      );

    const recalculated = Math.max(
      0,
      Number(investment.costBasis) + Number(gains.total) - Number(deductions.total),
    );

    // Check if there's still an active 'sale' event — if so, keep isActive=false
    const [saleCheck] = await tx
      .select({ count: sql<number>`count(*)` })
      .from(investmentEvents)
      .where(
        and(
          eq(investmentEvents.investmentId, investmentId),
          sql`${investmentEvents.eventType} = 'sale'`,
        ),
      );

    const hasActiveSale = saleCheck.count > 0;

    await tx
      .update(investments)
      .set({
        currentValue: String(recalculated),
        isActive: !hasActiveSale,
        updatedAt: new Date(),
      })
      .where(and(eq(investments.id, investmentId), eq(investments.workspaceId, workspaceId)));
  });
}
