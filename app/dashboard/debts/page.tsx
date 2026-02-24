import { DebtsCreditsManagement } from "@/components/dashboard/debts-credits-management";

export default function DebtsPage() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Debts & Credit
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Monitor your credit cards, loans, and other debts. Log balance updates
          each month to track your progress towards being debt-free.
        </p>
      </div>

      <DebtsCreditsManagement />
    </div>
  );
}
