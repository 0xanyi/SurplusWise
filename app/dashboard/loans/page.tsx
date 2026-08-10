import { LoansGivenManagement } from "@/components/dashboard/loans-given-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function LoansPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Balance sheet"
        title="Loans given"
      />

      <LoansGivenManagement />
    </div>
  );
}
