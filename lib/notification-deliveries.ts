import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/db/client";
import { notificationDeliveries } from "@/db/schema";

interface DeliveryIdentity {
  userId: string;
  workspaceId: string;
  destinationKey: string;
  eventKey: string;
  channel: "web_push" | "email";
  subscriptionId?: string;
}

/** Reserve one destination/channel occurrence so concurrent cron runs cannot both send it. */
export async function claimDelivery(identity: DeliveryIdentity) {
  const now = new Date();
  const inserted = await db
    .insert(notificationDeliveries)
    .values({
      id: crypto.randomUUID(),
      userId: identity.userId,
      workspaceId: identity.workspaceId,
      subscriptionId: identity.subscriptionId,
      destinationKey: identity.destinationKey,
      eventKey: identity.eventKey,
      channel: identity.channel,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: notificationDeliveries.id });
  if (inserted[0]) return inserted[0].id;

  // A crashed worker must not suppress this occurrence forever.
  const staleBefore = new Date(now.getTime() - 15 * 60_000);
  const reclaimed = await db
    .update(notificationDeliveries)
    .set({ updatedAt: now })
    .where(
      and(
        eq(notificationDeliveries.workspaceId, identity.workspaceId),
        eq(notificationDeliveries.destinationKey, identity.destinationKey),
        eq(notificationDeliveries.eventKey, identity.eventKey),
        eq(notificationDeliveries.channel, identity.channel),
        eq(notificationDeliveries.status, "pending"),
        lt(notificationDeliveries.updatedAt, staleBefore),
      ),
    )
    .returning({ id: notificationDeliveries.id });
  return reclaimed[0]?.id ?? null;
}

export async function completeDeliveries(ids: string[], sentAt = new Date()) {
  if (ids.length === 0) return;
  await db
    .update(notificationDeliveries)
    .set({ status: "sent", sentAt, updatedAt: sentAt })
    .where(inArray(notificationDeliveries.id, ids));
}

export async function releaseDeliveries(ids: string[]) {
  if (ids.length === 0) return;
  await db.delete(notificationDeliveries).where(inArray(notificationDeliveries.id, ids));
}
