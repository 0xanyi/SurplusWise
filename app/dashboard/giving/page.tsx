import { GivingManagement } from "@/components/dashboard/giving/giving-management";
import { GivingCommitments } from "@/components/dashboard/giving/giving-commitments";
import { PageHeader } from "@/components/dashboard/page-header";

export default function GivingPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader kicker="Giving" title="Giving workspace" />
      <p className="max-w-2xl text-sm text-muted-foreground">
        Keep recipient and fund names separate from broad giving categories, so every gift can
        retain both its purpose and where it went.
      </p>
      <GivingCommitments />
      <div className="pt-2">
        <h2 className="font-display text-base font-semibold">Recipients & funds</h2>
        <p className="mt-1 text-xs text-muted-foreground">Manage where gifts go and the funds they support.</p>
      </div>
      <GivingManagement />
    </div>
  );
}
