import { RecurringOutgoingsManagement } from "@/components/dashboard/recurring-outgoings-management";

export default function OutgoingsPage() {
  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          Monthly Outgoings
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          Track your regular monthly bills, subscriptions, and fixed expenses so
          you always know what&apos;s going out.
        </p>
      </div>

      <RecurringOutgoingsManagement />
    </div>
  );
}
