import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import { acceptInvitation } from "@/lib/db/workspace-members";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) throw new Error("Unauthorized");
    const body = await request.json();
    await acceptInvitation(body.token, session.user.id, session.user.email);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Invitation")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to accept workspace invitation:", error);
    return NextResponse.json({ error: "Failed to accept invitation" }, { status: 500 });
  }
}
