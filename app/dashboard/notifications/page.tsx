import { NotificationsInbox } from "@/components/dashboard/notifications-inbox";
import { PageHeader } from "@/components/dashboard/page-header";

export default function NotificationsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Money in & out"
        title="Notifications"
        description="A live inbox for income and payments that are due soon or overdue."
        actions={<span />}
      />
      <NotificationsInbox />
    </div>
  );
}
