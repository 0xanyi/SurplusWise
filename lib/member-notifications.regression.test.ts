import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaceMemberships } from "@/db/schema";
import * as notifications from "./db/notifications";
import * as recurringMoney from "./db/recurring-outgoings";
import * as workspaces from "./db/workspaces";
import {
  dispatchEmailNotifications,
  getEmailNotificationStatus,
  setEmailNotifications,
} from "./email-notifications";

describe(
  "per-member notifications regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("keeps member reads and delivery preferences separate over one shared ledger", async () => {
      const original = {
        smtpUrl: process.env.SMTP_URL,
        smtpFrom: process.env.SMTP_FROM,
        siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
      };
      process.env.SMTP_URL = "smtp://mailer:secret@mail.example.com:587";
      process.env.SMTP_FROM = "Sika <sika@example.com>";
      process.env.NEXT_PUBLIC_SITE_URL = "https://sika.example";

      const ownerId = crypto.randomUUID();
      const memberId = crypto.randomUUID();
      const memberEmail = `notification-member-${memberId.slice(0, 8)}@example.com`;
      await db.insert(users).values([
        {
          id: ownerId,
          name: "Notification owner",
          email: `notification-owner-${ownerId.slice(0, 8)}@example.com`,
        },
        { id: memberId, name: "Notification member", email: memberEmail },
      ]);

      try {
        const workspace = await workspaces.create(ownerId, {
          name: "Shared reminders",
          type: "personal",
        });
        await db.insert(workspaceMemberships).values({
          workspaceId: workspace.id,
          userId: memberId,
          role: "viewer",
        });
        await recurringMoney.create(workspace.id, {
          name: "Shared rent",
          amount: 900,
          type: "expense",
          dayOfMonth: 15,
        });

        const memberItems = await notifications.listCurrent(
          workspace.id,
          memberId,
          "2028-08-15",
        );
        const due = memberItems.find((item) => item.title === "Shared rent")!;
        assert.equal(due.readAt, null);
        await notifications.markRead(memberId, workspace.id, due.id, true);
        assert.ok(
          (await notifications.listCurrent(workspace.id, memberId, "2028-08-15"))
            .find((item) => item.id === due.id)?.readAt,
        );
        assert.equal(
          (await notifications.listCurrent(workspace.id, ownerId, "2028-08-15"))
            .find((item) => item.id === due.id)?.readAt,
          null,
        );

        await setEmailNotifications(memberId, workspace.id, true);
        assert.equal((await getEmailNotificationStatus(memberId, workspace.id)).enabled, true);
        assert.equal((await getEmailNotificationStatus(ownerId, workspace.id)).enabled, false);
        await notifications.markRead(memberId, workspace.id, due.id, false);

        const messages: Array<{ to: string; text: string }> = [];
        const result = await dispatchEmailNotifications({
          today: "2028-08-15",
          send: async (message) => messages.push({ to: message.to, text: message.text }),
        });
        assert.equal(result.emails, 1);
        assert.equal(messages[0].to, memberEmail);
        assert.match(messages[0].text, /Shared rent/);

        await db
          .delete(workspaceMemberships)
          .where(
            eq(workspaceMemberships.userId, memberId),
          );
        const afterRemoval = await dispatchEmailNotifications({
          today: "2028-09-15",
          send: async (message) => messages.push({ to: message.to, text: message.text }),
        });
        assert.equal(afterRemoval.emails, 0, "removed members must not receive shared reminders");
        assert.equal(messages.length, 1);
      } finally {
        await db.delete(users).where(eq(users.id, ownerId));
        await db.delete(users).where(eq(users.id, memberId));
        if (original.smtpUrl === undefined) delete process.env.SMTP_URL;
        else process.env.SMTP_URL = original.smtpUrl;
        if (original.smtpFrom === undefined) delete process.env.SMTP_FROM;
        else process.env.SMTP_FROM = original.smtpFrom;
        if (original.siteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
        else process.env.NEXT_PUBLIC_SITE_URL = original.siteUrl;
      }
    });
  },
);
