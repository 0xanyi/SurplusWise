import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as txService from "@/lib/db/transactions";
import { checkRateLimit } from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

// ─── Pagination defaults & guards ────────────────────────────────────────────

const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MAX_PAGE = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Map DB row → stable API response shape. */
function toTransaction(row: Awaited<ReturnType<typeof txService.list>>[number]) {
  return {
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    type: row.type,
    account_id: row.accountId ?? null,
    status: row.status,
    needs_review: row.needsReview,
    category: row.category,
    payee: row.payee ?? null,
    client_id: row.clientId ?? null,
    giving_recipient_id: row.givingRecipientId ?? null,
    giving_designation_id: row.givingDesignationId ?? null,
    notes: row.notes ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    receipt_url: row.receiptStorageId ?? null,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace("viewer");

    const sp = request.nextUrl.searchParams;

    // Parse filters
    const type = sp.get("type") as txService.ListFilters["type"] | null;
    const accountId = sp.get("accountId") ?? undefined;
    const status = sp.get("status") as txService.ListFilters["status"] | null;
    const needsReview = sp.get("needsReview");
    const category = sp.get("category") ?? undefined;
    const clientId = sp.get("clientId") ?? undefined;
    const tag = sp.get("tag") ?? undefined;
    const startDate = sp.get("startDate") ?? undefined;
    const endDate = sp.get("endDate") ?? undefined;
    const search = sp.get("search") ?? undefined;

    if (needsReview !== null && needsReview !== "true" && needsReview !== "false") {
      return NextResponse.json(
        { error: "Invalid needsReview filter: expected true or false" },
        { status: 400 },
      );
    }

    const filters: txService.ListFilters = {
      ...(type && { type }),
      ...(accountId && { accountId }),
      ...(status && { status }),
      ...(needsReview === "true" && { needsReview: true }),
      ...(needsReview === "false" && { needsReview: false }),
      ...(category && { category }),
      ...(clientId && { clientId }),
      ...(tag && { tag }),
      ...(startDate && { startDate }),
      ...(endDate && { endDate }),
      ...(search && { search }),
    };

    // Parse pagination
    const rawPage = sp.has("page")
      ? parseInt(sp.get("page")!, 10)
      : DEFAULT_PAGE;

    if (sp.has("page") && (isNaN(rawPage) || rawPage < 0 || rawPage > MAX_PAGE)) {
      return NextResponse.json(
        { error: `Invalid page: must be between 0 and ${MAX_PAGE}` },
        { status: 400 },
      );
    }

    const page = rawPage;
    const pageSize = sp.has("pageSize")
      ? clamp(
          parseInt(sp.get("pageSize")!, 10) || DEFAULT_PAGE_SIZE,
          1,
          MAX_PAGE_SIZE,
        )
      : DEFAULT_PAGE_SIZE;

    const result = await txService.listPaginated(
      userId,
      workspaceId,
      filters,
      page,
      pageSize,
    );

    return NextResponse.json({
      transactions: result.rows.map(toTransaction),
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateKey = `${request.headers.get("x-forwarded-for") ?? "local"}:transactions:create`;
    const rateLimit = checkRateLimit(rateKey, { limit: 60, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many requests. Please try again shortly." },
        { status: 429 },
      );
    }

    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = await request.json();

    const receiptStorageId = body.receiptStorageId ?? body.receipt_url ?? null;

    const row = await txService.create(userId, workspaceId, {
      amount: body.amount,
      date: body.date,
      type: body.type,
      accountId: body.accountId ?? body.account_id,
      status: body.status,
      category: body.category,
      payee: body.payee ?? null,
      clientId: body.clientId ?? body.client_id ?? null,
      givingRecipientId: body.givingRecipientId ?? body.giving_recipient_id ?? null,
      givingDesignationId: body.givingDesignationId ?? body.giving_designation_id ?? null,
      notes: body.notes ?? null,
      tags: Array.isArray(body.tags) ? body.tags : [],
      receiptStorageId,
    });

    return NextResponse.json(
      { id: row.id, transaction: toTransaction(row) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    if (error instanceof txService.GivingAttributionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to create transaction:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}
