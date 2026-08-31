import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users, workspaces } from "@/db/schema";
import * as goalActivitiesService from "./goal-activities";
import * as goalsService from "./goals";

describe(
  "goal funding activity regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("keeps contributions and spending atomic and workspace-scoped", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();

      await db.insert(users).values({
        id: userId,
        name: "Goal activity test user",
        email: `goal-activity-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Personal",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Other",
          type: "personal",
          currency: "GBP",
          isDefault: false,
        },
      ]);

      try {
        const goal = await goalsService.create(workspaceId, {
          name: "Annual insurance",
          category: "savings",
          targetAmount: 600,
          currentAmount: 100,
          targetDate: "2028-12-01",
        });

        await assert.rejects(
          goalActivitiesService.create(otherWorkspaceId, goal.id, {
            type: "contribution",
            amount: 50,
            occurredOn: "2028-01-01",
          }),
          /not found or unauthorized/,
        );

        await goalActivitiesService.create(workspaceId, goal.id, {
          type: "contribution",
          amount: 50,
          occurredOn: "2028-01-01",
          notes: "January funding",
        });
        await goalActivitiesService.create(workspaceId, goal.id, {
          type: "spending",
          amount: 40,
          occurredOn: "2028-02-01",
          notes: "Deposit paid",
        });

        const [updated] = await goalsService.list(workspaceId);
        assert.equal(updated.currentAmount, "110.00");

        const activities = await goalActivitiesService.list(workspaceId, goal.id);
        assert.deepEqual(
          activities.map((activity) => [activity.type, activity.amount]),
          [
            ["spending", "40.00"],
            ["contribution", "50.00"],
          ],
        );
        assert.equal((await goalActivitiesService.getSpentByGoal(workspaceId)).get(goal.id), 40);

        await assert.rejects(
          goalActivitiesService.create(workspaceId, goal.id, {
            type: "spending",
            amount: 111,
            occurredOn: "2028-02-02",
          }),
          /cannot exceed the fund's available amount/,
        );
        const [unchanged] = await goalsService.list(workspaceId);
        assert.equal(unchanged.currentAmount, "110.00");
        assert.equal((await goalActivitiesService.list(workspaceId, goal.id)).length, 2);
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
