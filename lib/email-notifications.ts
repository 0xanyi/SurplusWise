import nodemailer from "nodemailer";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  emailNotificationPreferences,
  users,
  workspaces,
} from "@/db/schema";
import * as notificationsService from "@/lib/db/notifications";
import { userIdSchema, workspaceIdSchema } from "@/lib/db/validation";
import {
  claimDelivery,
  completeDeliveries,
  releaseDeliveries,
} from "@/lib/notification-deliveries";
import { formatCurrency } from "@/lib/utils";

export class EmailConfigurationError extends Error {
  constructor() {
    super("Email notifications are not configured");
  }
}

interface EmailConfiguration {
  smtpUrl: string;
  from: string;
  siteUrl: string;
}

function deliveryConfiguration(): EmailConfiguration {
  const smtpUrl = process.env.SMTP_URL?.trim();
  const from = process.env.SMTP_FROM?.trim();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!smtpUrl || !from || !siteUrl) throw new EmailConfigurationError();

  try {
    const smtp = new URL(smtpUrl);
    const site = new URL(siteUrl);
    if (!["smtp:", "smtps:"].includes(smtp.protocol)) throw new Error();
    if (!["http:", "https:"].includes(site.protocol)) throw new Error();
    return { smtpUrl, from, siteUrl: site.origin };
  } catch {
    throw new EmailConfigurationError();
  }
}

export function emailNotificationsConfigured() {
  try {
    deliveryConfiguration();
    return true;
  } catch {
    return false;
  }
}

export async function getEmailNotificationStatus(userId: string, workspaceId: string) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  const [result] = await db
    .select({ enabled: emailNotificationPreferences.enabled, email: users.email })
    .from(users)
    .leftJoin(
      emailNotificationPreferences,
      and(
        eq(emailNotificationPreferences.userId, users.id),
        eq(emailNotificationPreferences.workspaceId, workspaceId),
      ),
    )
    .where(eq(users.id, userId))
    .limit(1);
  if (!result) throw new Error("User not found or unauthorized");
  return {
    configured: emailNotificationsConfigured(),
    enabled: result.enabled ?? false,
    email: result.email,
  };
}

export async function setEmailNotifications(userId: string, workspaceId: string, enabled: boolean) {
  userIdSchema.parse(userId);
  workspaceIdSchema.parse(workspaceId);
  if (enabled && !emailNotificationsConfigured()) throw new EmailConfigurationError();
  const now = new Date();
  await db
    .insert(emailNotificationPreferences)
    .values({ id: crypto.randomUUID(), userId, workspaceId, enabled, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: emailNotificationPreferences.workspaceId,
      set: { userId, enabled, updatedAt: now },
    });
}

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

type EmailSender = (message: EmailMessage) => Promise<unknown>;

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

function messageFor(
  recipient: string,
  workspace: { name: string; currency: string },
  notifications: Awaited<ReturnType<typeof notificationsService.listCurrent>>,
  config: EmailConfiguration,
): EmailMessage {
  const rawSubject = notifications.length === 1
    ? `${notifications[0].title} — ${notifications[0].description}`
    : `${notifications.length} reminders for ${workspace.name}`;
  const subject = rawSubject.replace(/[\r\n]+/g, " ");
  const lines = notifications.map((notification) =>
    `${notification.title}: ${formatCurrency(notification.amount, workspace.currency)} — ${notification.description}\n${new URL(notification.href, config.siteUrl).href}`,
  );
  const rows = notifications.map((notification) => {
    const href = new URL(notification.href, config.siteUrl).href;
    return `<li style="margin:0 0 16px"><strong>${escapeHtml(notification.title)}</strong> — ${escapeHtml(formatCurrency(notification.amount, workspace.currency))}<br>${escapeHtml(notification.description)}<br><a href="${escapeHtml(href)}">Open in Sika</a></li>`;
  }).join("");

  return {
    from: config.from,
    to: recipient,
    subject,
    text: `Sika reminders for ${workspace.name}\n\n${lines.join("\n\n")}\n\nYou enabled these reminders in Sika Settings.`,
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.5;color:#18181b"><h1 style="font-size:20px">Sika reminders for ${escapeHtml(workspace.name)}</h1><ul style="padding-left:20px">${rows}</ul><p style="color:#71717a;font-size:13px">You enabled these reminders in Sika Settings.</p></div>`,
  };
}

export interface EmailDispatchSummary {
  workspaces: number;
  notifications: number;
  sent: number;
  skipped: number;
  failed: number;
  emails: number;
}

export async function dispatchEmailNotifications(options: { today?: string; send?: EmailSender } = {}) {
  const config = deliveryConfiguration();
  const transporter = options.send ? null : nodemailer.createTransport(config.smtpUrl);
  const send = options.send ?? ((message: EmailMessage) => transporter!.sendMail(message));
  const preferences = await db
    .select({
      userId: emailNotificationPreferences.userId,
      workspaceId: emailNotificationPreferences.workspaceId,
      email: users.email,
      workspaceName: workspaces.name,
      currency: workspaces.currency,
    })
    .from(emailNotificationPreferences)
    .innerJoin(users, eq(users.id, emailNotificationPreferences.userId))
    .innerJoin(workspaces, eq(workspaces.id, emailNotificationPreferences.workspaceId))
    .where(eq(emailNotificationPreferences.enabled, true));

  const summary: EmailDispatchSummary = {
    workspaces: preferences.length,
    notifications: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    emails: 0,
  };

  for (const preference of preferences) {
    const notifications = (await notificationsService.listCurrent(
      preference.userId,
      preference.workspaceId,
      options.today,
    )).filter((notification) => !notification.readAt);
    summary.notifications += notifications.length;
    const claimed: Array<{
      deliveryId: string;
      notification: (typeof notifications)[number];
    }> = [];

    for (const notification of notifications) {
      const deliveryId = await claimDelivery({
        userId: preference.userId,
        workspaceId: preference.workspaceId,
        destinationKey: `email:${preference.userId}`,
        eventKey: notification.id,
        channel: "email",
      });
      if (deliveryId) claimed.push({ deliveryId, notification });
      else summary.skipped += 1;
    }
    if (claimed.length === 0) continue;

    const deliveryIds = claimed.map(({ deliveryId }) => deliveryId);
    try {
      await send(messageFor(
        preference.email,
        { name: preference.workspaceName, currency: preference.currency },
        claimed.map(({ notification }) => notification),
        config,
      ));
    } catch {
      await releaseDeliveries(deliveryIds);
      summary.failed += claimed.length;
      continue;
    }
    await completeDeliveries(deliveryIds);
    summary.sent += claimed.length;
    summary.emails += 1;
  }

  return summary;
}
