import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceInvitations, workspaceMemberships } from "@/db/schema";
import * as workspaceMembers from "./workspace-members";
import * as workspaces from "./workspaces";

describe(
  "workspace invitations regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("provisions a separate identity through a single-use invitation", async () => {
      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      const memberEmail = `invited-${memberId.slice(0, 8)}@example.com`;
      await db.insert(users).values([
        { id: ownerId, name: "Invitation owner", email: `owner-${ownerId.slice(0, 8)}@example.com` },
        { id: memberId, name: "Invited member", email: memberEmail },
      ]);

      try {
        const workspace = await workspaces.create(ownerId, {
          name: "Invitation test",
          type: "personal",
        });
        const created = await workspaceMembers.createInvitation(ownerId, workspace.id, {
          email: memberEmail.toUpperCase(),
          role: "viewer",
        });
        assert.equal(created.invitation.email, memberEmail);
        assert.notEqual(created.invitation.tokenHash, created.token);
        assert.equal((await workspaceMembers.getValidInvitation(created.token))?.role, "viewer");

        await assert.rejects(
          workspaceMembers.acceptInvitation(created.token, memberId, "wrong@example.com"),
          /invalid or has expired/,
        );
        await workspaceMembers.acceptInvitation(created.token, memberId, memberEmail);
        assert.equal(await workspaceMembers.getValidInvitation(created.token), null);
        assert.equal((await workspaces.getAccess(memberId, workspace.id))?.role, "viewer");

        await workspaceMembers.updateRole(ownerId, workspace.id, memberId, "editor");
        assert.equal((await workspaces.getAccess(memberId, workspace.id))?.role, "editor");
        await assert.rejects(
          workspaceMembers.updateRole(memberId, workspace.id, ownerId, "viewer"),
          /not found or unauthorized/,
        );

        await workspaceMembers.removeMember(ownerId, workspace.id, memberId);
        assert.equal(await workspaces.getAccess(memberId, workspace.id), null);
        await assert.rejects(
          workspaceMembers.acceptInvitation(created.token, memberId, memberEmail),
          /invalid or has expired/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
        await db.delete(users).where(eq(users.id, memberId));
      }
    });

    it("replaces and revokes pending invitations without exposing their token", async () => {
      const ownerId = crypto.randomUUID();
      await db.insert(users).values({
        id: ownerId,
        name: "Invitation revoke owner",
        email: `revoke-owner-${ownerId.slice(0, 8)}@example.com`,
      });

      try {
        const workspace = await workspaces.create(ownerId, {
          name: "Invitation revoke test",
          type: "personal",
        });
        const first = await workspaceMembers.createInvitation(ownerId, workspace.id, {
          email: "pending@example.com",
          role: "viewer",
        });
        const replacement = await workspaceMembers.createInvitation(ownerId, workspace.id, {
          email: "pending@example.com",
          role: "editor",
        });
        assert.equal(await workspaceMembers.getValidInvitation(first.token), null);
        assert.equal((await workspaceMembers.list(ownerId, workspace.id)).invitations.length, 1);

        await workspaceMembers.revokeInvitation(ownerId, workspace.id, replacement.invitation.id);
        assert.equal(await workspaceMembers.getValidInvitation(replacement.token), null);
        const [stored] = await db
          .select({ tokenHash: workspaceInvitations.tokenHash })
          .from(workspaceInvitations)
          .where(
            and(
              eq(workspaceInvitations.workspaceId, workspace.id),
              eq(workspaceInvitations.email, "pending@example.com"),
            ),
          );
        assert.equal(stored, undefined);
        const [ownerMembership] = await db
          .select({ role: workspaceMemberships.role })
          .from(workspaceMemberships)
          .where(
            and(
              eq(workspaceMemberships.workspaceId, workspace.id),
              eq(workspaceMemberships.userId, ownerId),
            ),
          );
        assert.equal(ownerMembership.role, "owner");
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
      }
    });
  },
);
