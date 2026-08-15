import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api-errors";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import {
  PushConfigurationError,
  PushSubscriptionConflictError,
  getSubscriptionStatus,
  pushSubscriptionSchema,
  subscribe,
  unsubscribe,
} from "@/lib/push-notifications";

const endpointSchema = z.string().url().max(2048);
const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), endpoint: endpointSchema.optional() }),
  z.object({
    action: z.literal("subscribe"),
    subscription: pushSubscriptionSchema,
    oldEndpoint: endpointSchema.optional(),
  }),
  z.object({ action: z.literal("unsubscribe"), endpoint: endpointSchema.optional() }),
]);

function pushErrorResponse(error: unknown) {
  if (error instanceof PushConfigurationError) {
    return NextResponse.json({ error: error.message }, { status: 503 });
  }
  if (error instanceof PushSubscriptionConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  return errorResponse(error, "Failed to update push notifications");
}

export async function GET() {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("viewer");
    return NextResponse.json(await getSubscriptionStatus(actorUserId, workspaceId));
  } catch (error) {
    return pushErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace("viewer");
    const body = requestSchema.parse(await request.json());

    if (body.action === "subscribe") {
      await subscribe(actorUserId, workspaceId, body.subscription, body.oldEndpoint);
    } else if (body.action === "unsubscribe") {
      await unsubscribe(actorUserId, workspaceId, body.endpoint);
    }

    const endpoint = body.action === "subscribe"
      ? body.subscription.endpoint
      : body.endpoint;
    return NextResponse.json(await getSubscriptionStatus(actorUserId, workspaceId, endpoint));
  } catch (error) {
    return pushErrorResponse(error);
  }
}
