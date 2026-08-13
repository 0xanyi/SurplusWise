import {
  dispatchEmailNotifications,
  emailNotificationsConfigured,
} from "@/lib/email-notifications";
import {
  dispatchPushNotifications,
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

  // Both channels derive due-money items through the same calendar source; run them
  // sequentially rather than racing its idempotent current-month materialization.
  const webPush = pushConfigured ? await dispatchPushNotifications() : null;
  const email = emailConfigured ? await dispatchEmailNotifications() : null;
  return { web_push: webPush, email };
}
