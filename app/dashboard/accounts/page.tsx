import { FinancialAccountsManagement } from "@/components/dashboard/financial-accounts-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function AccountsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader kicker="Balance sheet" title="Accounts" />
      <FinancialAccountsManagement />
    </div>
  );
}
