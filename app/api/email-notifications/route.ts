import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-errors";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import {
  EmailConfigurationError,
  getEmailNotificationStatus,
  setEmailNotifications,
} from "@/lib/email-notifications";

const updateSchema = z.object({ enabled: z.boolean() });

function emailErrorResponse(error: unknown) {
  if (error instanceof EmailConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  return errorResponse(error, "Failed to update email notifications");
}

export async function GET() {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("viewer");
    return NextResponse.json(await getEmailNotificationStatus(actorUserId, workspaceId));
  } catch (error) {
    return emailErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const { enabled } = updateSchema.parse(await request.json());
    await setEmailNotifications(actorUserId, workspaceId, enabled);
    return NextResponse.json(await getEmailNotificationStatus(actorUserId, workspaceId));
  } catch (error) {
    return emailErrorResponse(error);
  }
}
