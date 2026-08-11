import { DebtDetail } from "@/components/dashboard/debts/debt-detail";

export default async function DebtDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <DebtDetail debtId={id} />
    </div>
  );
}
