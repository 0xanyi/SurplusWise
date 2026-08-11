import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Map a thrown error to the response shape the API already uses: 401 for auth,
 * 400 for validation, 404 for missing-or-not-yours, 409 for a uniqueness clash,
 * 500 for anything unrecognised.
 */
/**
 * Postgres error code, wherever it ended up. Drizzle wraps driver errors in a
 * query error and hangs the original off `cause`, so the code is one level down.
 */
function getPostgresCode(error: unknown): string | null {
  let current = error;

  for (let depth = 0; depth < 4 && current != null; depth += 1) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string") return code;
    current = (current as { cause?: unknown }).cause;
  }

  return null;
}

export function errorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: error.issues[0]?.message ?? "Validation error" },
      { status: 400 },
    );
  }

  if (error instanceof Error) {
    if (error.message.includes("not found") || error.message.includes("unauthorized")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error.message.includes("period end must not be before period start")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  // Postgres unique_violation: a statement already covers this period.
  if (getPostgresCode(error) === "23505") {
    return NextResponse.json(
      { error: "A statement already covers this period" },
      { status: 409 },
    );
  }

  console.error(`${fallbackMessage}:`, error);
  return NextResponse.json({ error: fallbackMessage }, { status: 500 });
}
