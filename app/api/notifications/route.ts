import { NextRequest, NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-errors";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as notificationsService from "@/lib/db/notifications";
import { idSchema } from "@/lib/db/validation";
import { z } from "zod";

const updateSchema = z.object({
  id: idSchema,
  read: z.boolean().optional().default(true),
});

export async function POST() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const notifications = await notificationsService.listDue(userId, workspaceId);
    return NextResponse.json({
      notifications: notifications.map((notification) => ({
        id: notification.id,
        date: notification.date,
        title: notification.title,
        description: notification.description,
        amount: notification.amount,
        type: notification.type,
        days_until_due: notification.daysUntilDue,
        href: notification.href,
        read_at: notification.readAt?.toISOString() ?? null,
      })),
      unread: notifications.filter((notification) => !notification.readAt).length,
    });
  } catch (error) {
    return errorResponse(error, "Failed to load notifications");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const body = updateSchema.parse(await request.json());
    await notificationsService.markRead(userId, workspaceId, body.id, body.read);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, "Failed to update notification");
  }
}
