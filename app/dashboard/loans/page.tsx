import { LoansGivenManagement } from "@/components/dashboard/loans-given-management";

export default function LoansPage() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Loans Given
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Track money you&apos;ve lent to others, log repayments, and monitor
          outstanding balances.
        </p>
      </div>

      <LoansGivenManagement />
    </div>
  );
}
