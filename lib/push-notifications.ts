import { createHash, timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/db/client";
import {
  notificationDeliveries,
  pushNotificationPreferences,
  pushSubscriptions,
} from "@/db/schema";
import * as notificationsService from "@/lib/db/notifications";
import { userIdSchema, workspaceIdSchema } from "@/lib/db/validation";
import { z } from "zod";

const endpointSchema = z.string().url().max(2048).refine(
  (value) => new URL(value).protocol === "https:",
  "Push endpoint must use HTTPS",
);
const keySchema = z.string().min(1).max(512);

export const pushSubscriptionSchema = z.object({
  endpoint: endpointSchema,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: keySchema,
    auth: keySchema,
  }),
});

export type BrowserPushSubscription = z.infer<typeof pushSubscriptionSchema>;

export class PushConfigurationError extends Error {
  constructor() {
    super("Web Push is not configured");
  }
}

export function getPublicPushConfiguration() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim() ?? "";
  const configured = Boolean(
    publicKey
      && process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim()
      && process.env.WEB_PUSH_VAPID_SUBJECT?.trim(),
  );
  return { configured, publicKey: configured ? publicKey : null };
}

function getDeliveryConfiguration() {
  const publicKey = process.env.WEB_PUSH_VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.WEB_PUSH_VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.WEB_PUSH_VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) throw new PushConfigurationError();
  return { publicKey, privateKey, subject };
}

export function validDispatchToken(supplied: string | null) {
  const configured = process.env.NOTIFICATION_DISPATCH_TOKEN;
  if (!configured || !supplied) return false;
  const configuredDigest = createHash("sha256").update(configured).digest();
  const suppliedDigest = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(configuredDigest, suppliedDigest);
}

export async function getSubscriptionStatus(
  userId: string,
  workspaceId: string,
  endpoint?: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (endpoint) endpointSchema.parse(endpoint);

  const [preference] = await db
    .select({ enabled: pushNotificationPreferences.enabled })
    .from(pushNotificationPreferences)
    .where(
      and(
        eq(pushNotificationPreferences.userId, userId),
        eq(pushNotificationPreferences.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  let deviceEnabled = false;
  if (endpoint) {
    const [subscription] = await db
      .select({ enabled: pushSubscriptions.enabled })
      .from(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.workspaceId, workspaceId),
          eq(pushSubscriptions.endpoint, endpoint),
        ),
      )
      .limit(1);
    deviceEnabled = subscription?.enabled ?? false;
  }

  return {
    ...getPublicPushConfiguration(),
    enabled: preference?.enabled ?? false,
    deviceEnabled,
  };
}

export async function subscribe(
  userId: string,
  workspaceId: string,
  input: BrowserPushSubscription,
  oldEndpoint?: string,
) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const subscription = pushSubscriptionSchema.parse(input);
  if (oldEndpoint) endpointSchema.parse(oldEndpoint);
  if (!getPublicPushConfiguration().configured) throw new PushConfigurationError();

  const now = new Date();
  await db.transaction(async (tx) => {
    if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
      await tx
        .update(pushSubscriptions)
        .set({ enabled: false, updatedAt: now })
        .where(
          and(
            eq(pushSubscriptions.userId, userId),
            eq(pushSubscriptions.workspaceId, workspaceId),
            eq(pushSubscriptions.endpoint, oldEndpoint),
          ),
        );
    }

    await tx
      .insert(pushNotificationPreferences)
      .values({ id: crypto.randomUUID(), userId, workspaceId, enabled: true, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: pushNotificationPreferences.workspaceId,
        set: { userId, enabled: true, updatedAt: now },
      });

    const saved = await tx
      .insert(pushSubscriptions)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [pushSubscriptions.workspaceId, pushSubscriptions.endpoint],
        setWhere: eq(pushSubscriptions.userId, userId),
        set: {
          userId,
          workspaceId,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          enabled: true,
          updatedAt: now,
        },
      })
      .returning({ id: pushSubscriptions.id });
    if (!saved[0]) throw new Error("Push subscription not found or unauthorized");
  });
}

export async function unsubscribe(userId: string, workspaceId: string, endpoint?: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (endpoint) endpointSchema.parse(endpoint);
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(pushNotificationPreferences)
      .values({ id: crypto.randomUUID(), userId, workspaceId, enabled: false, createdAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: pushNotificationPreferences.workspaceId,
        set: { userId, enabled: false, updatedAt: now },
      });
    await tx
      .update(pushSubscriptions)
      .set({ enabled: false, updatedAt: now })
      .where(
        and(
          eq(pushSubscriptions.userId, userId),
          eq(pushSubscriptions.workspaceId, workspaceId),
        ),
      );
  });
}

type PushSender = (
  subscription: webpush.PushSubscription,
  payload: string,
  options: webpush.RequestOptions,
) => Promise<unknown>;

export interface DispatchSummary {
  subscriptions: number;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
  disabled: number;
}

async function claimDelivery(subscriptionId: string, userId: string, workspaceId: string, eventKey: string) {
  const now = new Date();
  const inserted = await db
    .insert(notificationDeliveries)
    .values({
      id: crypto.randomUUID(),
      subscriptionId,
      userId,
      workspaceId,
      eventKey,
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
        eq(notificationDeliveries.subscriptionId, subscriptionId),
        eq(notificationDeliveries.workspaceId, workspaceId),
        eq(notificationDeliveries.eventKey, eventKey),
        eq(notificationDeliveries.channel, "web_push"),
        eq(notificationDeliveries.status, "pending"),
        lt(notificationDeliveries.updatedAt, staleBefore),
      ),
    )
    .returning({ id: notificationDeliveries.id });
  return reclaimed[0]?.id ?? null;
}

export async function dispatchDuePush(options: { today?: string; send?: PushSender } = {}) {
  const config = getDeliveryConfiguration();
  const send = options.send ?? webpush.sendNotification.bind(webpush);
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      userId: pushSubscriptions.userId,
      workspaceId: pushSubscriptions.workspaceId,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .innerJoin(
      pushNotificationPreferences,
      and(
        eq(pushNotificationPreferences.userId, pushSubscriptions.userId),
        eq(pushNotificationPreferences.workspaceId, pushSubscriptions.workspaceId),
        eq(pushNotificationPreferences.enabled, true),
      ),
    )
    .where(eq(pushSubscriptions.enabled, true));

  const summary: DispatchSummary = {
    subscriptions: subscriptions.length,
    due: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    disabled: 0,
  };
  const dueByWorkspace = new Map<string, Awaited<ReturnType<typeof notificationsService.listDue>>>();

  for (const subscription of subscriptions) {
    const workspaceKey = `${subscription.userId}:${subscription.workspaceId}`;
    let due = dueByWorkspace.get(workspaceKey);
    if (!due) {
      due = (await notificationsService.listDue(
        subscription.userId,
        subscription.workspaceId,
        options.today,
      )).filter((notification) => !notification.readAt);
      dueByWorkspace.set(workspaceKey, due);
      summary.due += due.length;
    }

    for (const notification of due) {
      const deliveryId = await claimDelivery(
        subscription.id,
        subscription.userId,
        subscription.workspaceId,
        notification.id,
      );
      if (!deliveryId) {
        summary.skipped += 1;
        continue;
      }

      try {
        await send(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.description,
            href: notification.href,
            tag: notification.id,
          }),
          { TTL: 86_400, vapidDetails: config },
        );
        const sentAt = new Date();
        await db.transaction(async (tx) => {
          await tx
            .update(notificationDeliveries)
            .set({ status: "sent", sentAt, updatedAt: sentAt })
            .where(eq(notificationDeliveries.id, deliveryId));
          await tx
            .update(pushSubscriptions)
            .set({ lastSuccessAt: sentAt, updatedAt: sentAt })
            .where(eq(pushSubscriptions.id, subscription.id));
        });
        summary.sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: unknown }).statusCode;
        const failedAt = new Date();
        if (statusCode === 404 || statusCode === 410) {
          await db
            .update(pushSubscriptions)
            .set({ enabled: false, lastFailureAt: failedAt, updatedAt: failedAt })
            .where(eq(pushSubscriptions.id, subscription.id));
          summary.disabled += 1;
        } else {
          summary.failed += 1;
        }
        // Failed attempts may be retried; successful delivery is the deduplication boundary.
        await db.delete(notificationDeliveries).where(eq(notificationDeliveries.id, deliveryId));
        break;
      }
    }
  }

  return summary;
}
