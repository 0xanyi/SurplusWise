import { InvestmentsManagement } from "@/components/dashboard/investments-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function InvestmentsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Balance sheet"
        title="Investments"
        description="Manage your investment portfolio — stocks, crypto, forex, property, and more. Log returns, dividends, and sales to track your performance."
      />

      <InvestmentsManagement />
    </div>
  );
}
