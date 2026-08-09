import { LoansGivenManagement } from "@/components/dashboard/loans-given-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function LoansPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Balance sheet"
        title="Loans given"
        description="Track money you've lent to others, log repayments, and monitor outstanding balances."
      />

      <LoansGivenManagement />
    </div>
  );
}
