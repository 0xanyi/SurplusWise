import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import * as onboardingService from "./onboarding";
import * as workspacesService from "./workspaces";

describe(
  "onboarding status regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("tracks first-time setup per workspace instead of per user", async () => {
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Onboarding test user",
        email: `onboarding-${userId.slice(0, 8)}@example.com`,
      });

      try {
        const personal = await workspacesService.create(userId, {
          name: "Personal",
          type: "personal",
          currency: "GBP",
        });
        const business = await workspacesService.create(userId, {
          name: "Business",
          type: "business",
          currency: "GBP",
        });

        assert.equal(await onboardingService.getStatus(userId, personal.id), null);
        assert.equal(await onboardingService.getStatus(userId, business.id), null);

        await onboardingService.complete(userId, personal.id, { currency: "GBP" });

        assert.equal(
          (await onboardingService.getStatus(userId, personal.id))?.hasCompleted,
          true,
        );
        assert.equal(
          await onboardingService.getStatus(userId, business.id),
          null,
          "completing one workspace must not mark the others done",
        );

        await onboardingService.complete(userId, business.id, { currency: "USD" });

        // The regression: the row used to be keyed on user_id alone, so this
        // second call moved the personal workspace's row onto the business one.
        // The dashboard then re-read business as incomplete and the card never
        // went away.
        assert.equal(
          (await onboardingService.getStatus(userId, business.id))?.hasCompleted,
          true,
        );
        assert.equal(
          (await onboardingService.getStatus(userId, personal.id))?.hasCompleted,
          true,
          "completing a second workspace must not undo the first",
        );

        // Each workspace keeps the currency its own setup chose.
        assert.equal((await workspacesService.getById(userId, personal.id))?.currency, "GBP");
        assert.equal((await workspacesService.getById(userId, business.id))?.currency, "USD");
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("is idempotent when setup is finished twice for the same workspace", async () => {
      const userId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Onboarding rerun test user",
        email: `onboarding-rerun-${userId.slice(0, 8)}@example.com`,
      });

      try {
        const workspace = await workspacesService.create(userId, {
          name: "Personal",
          type: "personal",
          currency: "GBP",
        });

        await onboardingService.complete(userId, workspace.id, { currency: "GBP" });
        await onboardingService.complete(userId, workspace.id, { currency: "EUR" });

        assert.equal(
          (await onboardingService.getStatus(userId, workspace.id))?.hasCompleted,
          true,
        );
        assert.equal((await workspacesService.getById(userId, workspace.id))?.currency, "EUR");
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
