import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import * as transactions from "./transactions";
import * as workspaces from "./workspaces";

describe(
  "assigned transaction review regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("assigns, reviews, filters, and records acting members atomically", async () => {
      const ownerId = crypto.randomUUID();
      const reviewerId = crypto.randomUUID();
      const outsiderId = crypto.randomUUID();
      await db.insert(users).values([
        { id: ownerId, name: "Review owner", email: `review-owner-${ownerId.slice(0, 8)}@example.com` },
        { id: reviewerId, name: "Review editor", email: `review-editor-${reviewerId.slice(0, 8)}@example.com` },
        { id: outsiderId, name: "Review outsider", email: `review-outsider-${outsiderId.slice(0, 8)}@example.com` },
      ]);

      try {
        const workspace = await workspaces.create(ownerId, {
          name: "Review workflow",
          type: "business",
        });
        await db.insert(workspaceMemberships).values({
          workspaceId: workspace.id,
          userId: reviewerId,
          role: "editor",
        });
        const transaction = await transactions.create(workspace.id, {
          amount: 42,
          date: "2026-08-15",
          type: "expense",
          category: "Software",
        });

        await assert.rejects(
          transactions.bulkUpdateMetadata(
            workspace.id,
            { ids: [transaction.id], assignedToUserId: outsiderId },
            ownerId,
          ),
          /owner or editor/,
        );
        await transactions.bulkUpdateMetadata(
          workspace.id,
          { ids: [transaction.id], needsReview: true, assignedToUserId: reviewerId },
          ownerId,
        );
        assert.deepEqual(
          (await transactions.list(workspace.id, {
            needsReview: true,
            assignedToUserId: reviewerId,
          })).map((row) => row.id),
          [transaction.id],
        );

        await transactions.bulkUpdateMetadata(
          workspace.id,
          { ids: [transaction.id], needsReview: false },
          reviewerId,
        );
        const reviewed = await transactions.getById(workspace.id, transaction.id);
        assert.equal(reviewed?.needsReview, false);
        assert.equal(reviewed?.reviewedByUserId, reviewerId);
        assert.ok(reviewed?.reviewedAt);

        const history = await transactions.listReviewHistory(
          workspace.id,
          transaction.id,
        );
        assert.deepEqual(
          history.map((event) => ({
            action: event.action,
            actor: event.actorName,
            assignee: event.assignedToName,
          })),
          [
            { action: "reviewed", actor: "Review editor", assignee: null },
            { action: "reopened", actor: "Review owner", assignee: null },
            { action: "assigned", actor: "Review owner", assignee: "Review editor" },
          ],
        );
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
        await db.delete(users).where(eq(users.id, reviewerId));
        await db.delete(users).where(eq(users.id, outsiderId));
      }
    });
  },
);
