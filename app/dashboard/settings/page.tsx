import { BudgetManagement } from "@/components/dashboard/budget-management";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { GoalsManagement } from "@/components/dashboard/goals-management";
import { AIProviderSettings } from "@/components/dashboard/ai-provider-settings";
import { PageHeader } from "@/components/dashboard/page-header";
import { SettingsNav, type SettingsSection } from "@/components/dashboard/settings-nav";

const sections: SettingsSection[] = [
  { id: "ai-provider", label: "AI provider" },
  { id: "budgets", label: "Budgets" },
  { id: "categories", label: "Categories" },
  { id: "goals", label: "Goals" },
];

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-[22px] pb-4">
      <PageHeader kicker="Account" title="Settings" />

      <div className="grid items-start gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-[22px]">
        <SettingsNav sections={sections} />

        <div className="flex min-w-0 flex-col gap-[18px]">
          <section id="ai-provider" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                AI provider
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Configure your AI provider for receipt scanning. Use OpenAI,
                OpenRouter, Groq, or any OpenAI-compatible API.
              </p>
            </div>
            <AIProviderSettings />
          </section>

          <section id="budgets" className="scroll-mt-6 space-y-4">
            <div>
              <h2 className="font-display text-base font-semibold tracking-[-0.015em]">
                Budgets
              </h2>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Set monthly, quarterly, or yearly targets for income, expenses,
                and giving.
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
