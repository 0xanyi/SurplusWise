import {
  dispatchDueEmail,
  emailNotificationsConfigured,
} from "@/lib/email-notifications";
import {
  dispatchDuePush,
  getPublicPushConfiguration,
} from "@/lib/push-notifications";

export class NotificationConfigurationError extends Error {
  constructor() {
    super("No notification delivery channel is configured");
  }
}

export async function dispatchConfiguredNotifications() {
  const pushConfigured = getPublicPushConfiguration().configured;
  const emailConfigured = emailNotificationsConfigured();
  if (!pushConfigured && !emailConfigured) throw new NotificationConfigurationError();

  // Both channels derive current-month drafts through the same calendar source;
  // run them sequentially rather than racing that idempotent materialization.
  const webPush = pushConfigured ? await dispatchDuePush() : null;
  const email = emailConfigured ? await dispatchDueEmail() : null;
  return { web_push: webPush, email };
}
