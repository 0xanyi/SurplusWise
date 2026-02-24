import { InvestmentsManagement } from "@/components/dashboard/investments-management";

export default function InvestmentsPage() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Investments & Assets
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Manage your investment portfolio — stocks, crypto, forex, property, and
          more. Log returns, dividends, and sales to track your performance.
        </p>
      </div>

      <InvestmentsManagement />
    </div>
  );
}
