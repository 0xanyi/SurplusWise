import { LoanDetail } from "@/components/dashboard/loans/loan-detail";

export default async function LoanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <LoanDetail loanId={id} />
    </div>
  );
}
