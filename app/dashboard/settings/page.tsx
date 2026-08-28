import { BudgetManagement } from "@/components/dashboard/budget-management";
import { ProjectedIncomeManagement } from "@/components/dashboard/projected-income-management";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { GoalsManagement } from "@/components/dashboard/goals-management";
import { AIProviderSettings } from "@/components/dashboard/ai-provider-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsNav, type SettingsSection } from "@/components/dashboard/settings-nav";
import { TransactionRulesManagement } from "@/components/dashboard/transaction-rules-management";
import { PushNotificationSettings } from "@/components/dashboard/push-notification-settings";
import { EmailNotificationSettings } from "@/components/dashboard/email-notification-settings";
import { BackupStatusSettings } from "@/components/dashboard/backup-status-settings";
import { WorkspaceMembersSettings } from "@/components/dashboard/workspace-members-settings";

const sections: SettingsSection[] = [
  { id: "workspace-members", label: "Workspace members" },
  { id: "notifications", label: "Notifications" },
  { id: "data-resilience", label: "Data resilience" },
  { id: "ai-provider", label: "AI provider" },
  { id: "projected-income", label: "Projected income" },
  { id: "budgets", label: "Budgets" },
  { id: "categories", label: "Categories" },
  { id: "transaction-rules", label: "Transaction rules" },
  { id: "goals", label: "Goals" },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-[22px] pb-4">
      <PageHeader kicker="Account" title="Settings" />

      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-[22px]">
        <SettingsNav sections={sections} />

        <div className="flex min-w-0 flex-col gap-[18px]">
          <section id="workspace-members" className="scroll-mt-6">
            <WorkspaceMembersSettings />
          </section>

          <section id="notifications" className="scroll-mt-6 space-y-[18px]">
            <PushNotificationSettings />
            <EmailNotificationSettings />
          </section>

          <section id="data-resilience" className="scroll-mt-6">
            <BackupStatusSettings />
          </section>

          <section id="ai-provider" className="scroll-mt-6">
            <AIProviderSettings />
          </section>

          <section id="projected-income" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Projected income
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Set what you expect to receive this period, then compare it with
                recorded income. Personal and business workspaces each keep their
                own projections.
              </p>
            </div>
            <ProjectedIncomeManagement />
          </section>

          <section id="budgets" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Budgets
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Set monthly, quarterly, or yearly targets for expenses and giving.
              </p>
            </div>
            <BudgetManagement />
          </section>

          <section id="categories" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Categories
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Add or update custom categories to match your real spending and
                giving habits.
              </p>
            </div>
            <CategoryManagement />
          </section>

          <section id="transaction-rules" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Transaction rules
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Classify future imports from familiar payees or note text. Lower-priority numbers run first, and only the first matching rule applies.
              </p>
            </div>
            <TransactionRulesManagement />
          </section>

          <section id="goals" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Goals
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Create savings targets and track progress toward your important
                milestones.
              </p>
            </div>
            <GoalsManagement />
          </section>
        </div>
      </div>
    </div>
  );
}
