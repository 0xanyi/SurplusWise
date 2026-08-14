import { headers } from "next/headers";
import { auth } from "./auth";
import * as workspaceService from "./db/workspaces";
import type { WorkspaceRole } from "./db/workspaces";

// ─── Core server helpers ─────────────────────────────────────────────────────

/**
 * Return the current Better Auth session (user + session), or null.
 * Uses the incoming request cookies via `next/headers`.
 */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Quick boolean check – does the current request have a valid session?
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session !== null;
}

/**
 * Return the authenticated user's id, or throw 401.
 * Useful in API routes / server actions that require auth.
 */
export async function requireAuth(): Promise<string> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

/**
 * Resolve the active workspace and enforce its minimum role.
 * `userId` remains the workspace owner's ledger identity for compatibility
 * with workspace-scoped services; `actorUserId` is the signed-in member.
 * Without an `x-workspace-id` header, use the actor's own default workspace.
 */
export async function requireAuthWithWorkspace(
  requiredRole: WorkspaceRole = "editor",
): Promise<{
  userId: string;
  actorUserId: string;
  workspaceId: string;
  role: WorkspaceRole;
}> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  const actorUserId = session.user.id;

  const h = await headers();
  const headerWorkspaceId = h.get("x-workspace-id");

  if (headerWorkspaceId) {
    const access = await workspaceService.getAccess(actorUserId, headerWorkspaceId);
    if (access) {
      if (!workspaceService.hasWorkspaceRole(access.role, requiredRole)) {
        throw new Error("Unauthorized");
      }
      return {
        userId: access.workspace.userId,
        actorUserId,
        workspaceId: access.workspace.id,
        role: access.role,
      };
    }
  }

  // Fall back to default workspace
  const defaultWs = await workspaceService.getOrCreateDefault(actorUserId);
  return {
    userId: actorUserId,
    actorUserId,
    workspaceId: defaultWs.id,
    role: "owner",
  };
}
