import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { givingCommitments, users, workspaces } from "@/db/schema";
import * as commitmentsService from "./giving-commitments";
import * as recipientsService from "./giving-recipients";
import * as transactionsService from "./transactions";

describe(
  "giving commitments regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("compares scheduled expectations with exactly attributed gifts", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Commitment test user",
        email: `commitment-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Personal",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Other",
          type: "personal",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const recipient = await recipientsService.createRecipient(userId, workspaceId, {
          name: "Community Church",
        });
        const designation = await recipientsService.createDesignation(userId, workspaceId, {
          recipientId: recipient.id,
          name: "Building fund",
        });
        const otherRecipient = await recipientsService.createRecipient(userId, otherWorkspaceId, {
          name: "Other recipient",
        });

        const general = await commitmentsService.create(userId, workspaceId, {
          recipientId: recipient.id,
          name: "Monthly giving",
          amount: 100,
          frequency: "monthly",
          startDate: "2026-01-31",
        });
        const fund = await commitmentsService.create(userId, workspaceId, {
          recipientId: recipient.id,
          designationId: designation.id,
          name: "Building pledge",
          amount: 250,
          frequency: "one_time",
          startDate: "2026-02-15",
        });
        await assert.rejects(
          () =>
            commitmentsService.create(userId, workspaceId, {
              recipientId: recipient.id,
              name: "Duplicate general plan",
              amount: 50,
              frequency: "monthly",
              startDate: "2026-01-01",
            }),
          /already covers/,
        );
        await assert.rejects(
          () =>
            commitmentsService.create(userId, workspaceId, {
              recipientId: otherRecipient.id,
              name: "Cross-workspace plan",
              amount: 50,
              frequency: "monthly",
              startDate: "2026-01-01",
            }),
          /not found or unauthorized/,
        );

        await transactionsService.create(userId, workspaceId, {
          amount: 50,
          date: "2026-01-01",
          type: "giving",
          category: "Offering",
          givingRecipientId: recipient.id,
        });
        await transactionsService.create(userId, workspaceId, {
          amount: 175,
          date: "2026-02-01",
          type: "giving",
          category: "Offering",
          givingRecipientId: recipient.id,
        });
        await transactionsService.create(userId, workspaceId, {
          amount: 200,
          date: "2026-02-15",
          type: "giving",
          category: "Offering",
          givingRecipientId: recipient.id,
          givingDesignationId: designation.id,
        });

        const progress = await commitmentsService.getProgress(
          userId,
          workspaceId,
          "2026-01-01",
          "2026-03-31",
        );
        assert.equal(progress.expected, 550);
        assert.equal(progress.recorded, 375);
        assert.deepEqual(
          progress.rows.map((row) => ({ id: row.id, expected: row.expected, recorded: row.recorded })),
          [
            { id: fund.id, expected: 250, recorded: 200 },
            { id: general.id, expected: 300, recorded: 175 },
          ],
        );

        await assert.rejects(
          () => commitmentsService.update(userId, otherWorkspaceId, general.id, { amount: 120 }),
          /not found or unauthorized/,
        );
        await commitmentsService.update(userId, workspaceId, fund.id, { isActive: false });
        const activeProgress = await commitmentsService.getProgress(
          userId,
          workspaceId,
          "2026-01-01",
          "2026-03-31",
        );
        assert.equal(activeProgress.expected, 300);
        assert.equal(activeProgress.recorded, 175);
        assert.equal(activeProgress.rows.length, 2, "archived plans remain visible");

        await commitmentsService.update(userId, workspaceId, general.id, { isActive: false });
        const replacement = await commitmentsService.create(userId, workspaceId, {
          recipientId: recipient.id,
          name: "Replacement monthly giving",
          amount: 125,
          frequency: "monthly",
          startDate: "2026-04-01",
        });
        await assert.rejects(
          () => commitmentsService.update(userId, workspaceId, general.id, { isActive: true }),
          /already covers/,
          "an archived commitment cannot be restored over an active replacement",
        );
        await assert.rejects(
          () => db.insert(givingCommitments).values({
            id: crypto.randomUUID(),
            userId,
            workspaceId,
            recipientId: recipient.id,
            designationId: null,
            name: "Concurrent duplicate",
            amount: "10",
            frequency: "monthly",
            startDate: "2026-04-01",
          }),
          (error: unknown) =>
            (error as { cause?: { code?: string } }).cause?.code === "23505",
          "the database also protects the active target invariant",
        );
        assert.equal(replacement.isActive, true);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
