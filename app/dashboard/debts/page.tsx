import { DebtsCreditsManagement } from "@/components/dashboard/debts-credits-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function DebtsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Balance sheet"
        title="Debts & credit"
      />

      <DebtsCreditsManagement />
    </div>
  );
}
