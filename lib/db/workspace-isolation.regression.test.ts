import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import * as goalsService from "./goals";
import * as transactionsService from "./transactions";
import * as workspacesService from "./workspaces";

describe(
  "workspace isolation of the books",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    async function twoWorkspacesAndAnEditor() {
      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      await db.insert(users).values([
        {
          id: ownerId,
          name: "Books owner",
          email: `books-owner-${ownerId.slice(0, 8)}@example.com`,
        },
        {
          id: memberId,
          name: "Business editor",
          email: `books-editor-${memberId.slice(0, 8)}@example.com`,
        },
      ]);
      const personal = await workspacesService.create(ownerId, {
        name: "Personal isolation",
        type: "personal",
      });
      const business = await workspacesService.create(ownerId, {
        name: "Business isolation",
        type: "business",
      });
      await db.insert(workspaceMemberships).values({
        workspaceId: business.id,
        userId: memberId,
        role: "editor",
      });
      return { ownerId, memberId, personal, business };
    }

    it("does not let a Member holding one Workspace load or mutate a Transaction in another of the Owner's Workspaces", async () => {
      const { ownerId, personal, business } = await twoWorkspacesAndAnEditor();
      try {
        const personalTx = await transactionsService.create(personal.id, {
          amount: 12.5,
          date: "2026-08-20",
          type: "expense",
          category: "Food",
        });
        assert.equal(personalTx.userId, ownerId);
        assert.equal(personalTx.workspaceId, personal.id);

        assert.equal(await transactionsService.getById(business.id, personalTx.id), null);
        assert.deepEqual(
          (await transactionsService.list(business.id)).map((row) => row.id),
          [],
        );
        assert.deepEqual(
          (await transactionsService.list(personal.id)).map((row) => row.id),
          [personalTx.id],
        );

        await assert.rejects(
          transactionsService.update(business.id, personalTx.id, { notes: "Ada was here" }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          transactionsService.remove(business.id, personalTx.id),
          /not found or unauthorized/,
        );

        const stillThere = await transactionsService.getById(personal.id, personalTx.id);
        assert.equal(stillThere?.notes ?? null, null);
        assert.equal(stillThere?.id, personalTx.id);
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
      }
    });

    it("does not let a Member holding one Workspace load or mutate a Goal in another of the Owner's Workspaces", async () => {
      const { ownerId, personal, business } = await twoWorkspacesAndAnEditor();
      try {
        const personalGoal = await goalsService.create(personal.id, {
          name: "Emergency fund",
          category: "emergency_fund",
          targetAmount: 1000,
        });
        assert.equal(personalGoal.userId, ownerId);
        assert.equal(personalGoal.workspaceId, personal.id);

        assert.deepEqual(
          (await goalsService.list(business.id)).map((row) => row.id),
          [],
        );
        assert.deepEqual(
          (await goalsService.list(personal.id)).map((row) => row.id),
          [personalGoal.id],
        );

        await assert.rejects(
          goalsService.update(business.id, personalGoal.id, { name: "Ada was here" }),
          /not found or unauthorized/,
        );
        await assert.rejects(
          goalsService.remove(business.id, personalGoal.id),
          /not found or unauthorized/,
        );

        const stillThere = (await goalsService.list(personal.id))[0];
        assert.equal(stillThere?.name, "Emergency fund");
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
      }
    });
  },
);
