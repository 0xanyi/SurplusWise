import { RecurringOutgoingsManagement } from "@/components/dashboard/recurring-outgoings-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function OutgoingsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Money in & out"
        title="Recurring outgoings"
      />

      <RecurringOutgoingsManagement />
    </div>
  );
}
