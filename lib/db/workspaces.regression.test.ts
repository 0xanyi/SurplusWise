import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import * as workspacesService from "./workspaces";

describe(
  "workspace planning preferences regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("persists envelope budgeting as an optional workspace preference", async () => {
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Workspace preference test user",
        email: `workspace-preference-${userId.slice(0, 8)}@example.com`,
      });

      try {
        const workspace = await workspacesService.create(userId, {
          name: "Personal",
          type: "personal",
          currency: "GBP",
        });
        assert.equal(workspace.envelopeBudgetingEnabled, false);

        const enabled = await workspacesService.update(userId, workspace.id, {
          envelopeBudgetingEnabled: true,
        });
        assert.equal(enabled.envelopeBudgetingEnabled, true);
        assert.equal((await workspacesService.getById(userId, workspace.id))?.envelopeBudgetingEnabled, true);

        const disabled = await workspacesService.update(userId, workspace.id, {
          envelopeBudgetingEnabled: false,
        });
        assert.equal(disabled.envelopeBudgetingEnabled, false);

        await assert.rejects(
          workspacesService.update(userId, crypto.randomUUID(), {
            envelopeBudgetingEnabled: true,
          }),
          /not found or unauthorized/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
