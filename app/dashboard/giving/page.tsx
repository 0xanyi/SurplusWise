import { GivingManagement } from "@/components/dashboard/giving/giving-management";
import { PageHeader } from "@/components/dashboard/page-header";

export default function GivingPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader kicker="Giving" title="Recipients & funds" />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Keep recipient and fund names separate from broad giving categories, so every gift can
        retain both its purpose and where it went.
      </p>
      <GivingManagement />
    </div>
  );
}
