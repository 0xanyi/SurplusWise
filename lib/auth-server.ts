import { headers } from "next/headers";
import { auth } from "./auth";
import * as workspaceService from "./db/workspaces";

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
 * Return both the authenticated user's id and the active workspace id.
 * The workspace is resolved from the `x-workspace-id` header. If not set,
 * falls back to the user's default workspace (creating it if needed).
 */
export async function requireAuthWithWorkspace(): Promise<{
  userId: string;
  workspaceId: string;
}> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  const userId = session.user.id;

  const h = await headers();
  const headerWorkspaceId = h.get("x-workspace-id");

  if (headerWorkspaceId) {
    // Verify the workspace belongs to this user
    const ws = await workspaceService.getById(userId, headerWorkspaceId);
    if (ws) {
      return { userId, workspaceId: ws.id };
    }
  }

  // Fall back to default workspace
  const defaultWs = await workspaceService.getOrCreateDefault(userId);
  return { userId, workspaceId: defaultWs.id };
}
