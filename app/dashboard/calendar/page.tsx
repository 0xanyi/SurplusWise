import { FinancialCalendar } from "@/components/dashboard/financial-calendar";
import { PageHeader } from "@/components/dashboard/page-header";

export default function CalendarPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Money in & out"
        title="Financial calendar"
        description="Expected income, outgoings, giving, and debt payments in one monthly view."
        actions={<span />}
      />
      <FinancialCalendar />
    </div>
  );
}
