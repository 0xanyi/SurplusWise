import { headers } from "next/headers";
import { auth } from "./auth";

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


