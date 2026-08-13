import { NextRequest, NextResponse } from "next/server";
import {
  PushConfigurationError,
  dispatchDuePush,
  validDispatchToken,
} from "@/lib/push-notifications";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : null;
  if (!validDispatchToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await dispatchDuePush());
  } catch (error) {
    if (error instanceof PushConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Failed to dispatch Web Push notifications:", error);
    return NextResponse.json({ error: "Failed to dispatch notifications" }, { status: 500 });
  }
}
