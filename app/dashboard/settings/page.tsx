import { BudgetManagement } from "@/components/dashboard/budget-management";
import { CategoryManagement } from "@/components/dashboard/category-management";
import { GoalsManagement } from "@/components/dashboard/goals-management";

export default function SettingsPage() {
  return (
    <div className="space-y-10 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1.5 text-muted-foreground">
          Keep your setup simple: manage your budgets and categories.
        </p>
      </div>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Budgets</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Set monthly, quarterly, or yearly targets for income, expenses, and giving.
          </p>
        </div>
        <BudgetManagement />
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add or update custom categories to match your real spending and giving habits.
          </p>
        </div>
        <CategoryManagement />
      </section>

      <section className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Goals</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create savings targets and track progress toward your important milestones.
          </p>
        </div>
        <GoalsManagement />
      </section>
    </div>
  );
}
