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
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    return NextResponse.json(await getEmailNotificationStatus(userId, workspaceId));
  } catch (error) {
    return emailErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const { enabled } = updateSchema.parse(await request.json());
    await setEmailNotifications(userId, workspaceId, enabled);
    return NextResponse.json(await getEmailNotificationStatus(userId, workspaceId));
  } catch (error) {
    return emailErrorResponse(error);
  }
}
