import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
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
        const [membership] = await db
          .select()
          .from(workspaceMemberships)
          .where(eq(workspaceMemberships.workspaceId, workspace.id));
        assert.equal(membership.userId, userId);
        assert.equal(membership.role, "owner");

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

    it("resolves shared workspace roles without granting owner mutations", async () => {
      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      await db.insert(users).values([
        {
          id: ownerId,
          name: "Workspace owner",
          email: `workspace-owner-${ownerId.slice(0, 8)}@example.com`,
        },
        {
          id: memberId,
          name: "Workspace member",
          email: `workspace-member-${memberId.slice(0, 8)}@example.com`,
        },
      ]);

      try {
        const workspace = await workspacesService.create(ownerId, {
          name: "Shared",
          type: "personal",
          currency: "GBP",
        });

        assert.equal(await workspacesService.getAccess(memberId, workspace.id), null);
        await db.insert(workspaceMemberships).values({
          workspaceId: workspace.id,
          userId: memberId,
          role: "viewer",
        });

        assert.equal(await workspacesService.getById(memberId, workspace.id), null);
        assert.equal(
          (await workspacesService.getAccess(memberId, workspace.id))?.role,
          "viewer",
        );
        assert.deepEqual(
          (await workspacesService.list(memberId)).map((row) => ({
            id: row.id,
            role: row.role,
            isDefault: row.isDefault,
          })),
          [{ id: workspace.id, role: "viewer", isDefault: false }],
        );
        assert.deepEqual(
          (await workspacesService.list(ownerId)).map((row) => ({
            id: row.id,
            role: row.role,
          })),
          [{ id: workspace.id, role: "owner" }],
        );
        await assert.rejects(
          workspacesService.update(memberId, workspace.id, { name: "Renamed" }),
          /not found or unauthorized/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
        await db.delete(users).where(eq(users.id, memberId));
      }
    });

    it("orders role permissions from viewer to owner", () => {
      assert.equal(workspacesService.hasWorkspaceRole("viewer", "viewer"), true);
      assert.equal(workspacesService.hasWorkspaceRole("viewer", "editor"), false);
      assert.equal(workspacesService.hasWorkspaceRole("editor", "viewer"), true);
      assert.equal(workspacesService.hasWorkspaceRole("editor", "owner"), false);
      assert.equal(workspacesService.hasWorkspaceRole("owner", "editor"), true);
    });
  },
);
