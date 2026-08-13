import { NextRequest, NextResponse } from "next/server";
import { validDispatchToken } from "@/lib/push-notifications";
import {
  NotificationConfigurationError,
  dispatchConfiguredNotifications,
} from "@/lib/notification-dispatch";

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
    return NextResponse.json(await dispatchConfiguredNotifications());
  } catch (error) {
    if (error instanceof NotificationConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    console.error("Failed to dispatch notifications:", error);
    return NextResponse.json({ error: "Failed to dispatch notifications" }, { status: 500 });
  }
}
