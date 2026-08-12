import { ClientDetail } from "@/components/dashboard/clients/client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <ClientDetail clientId={id} />
    </div>
  );
}
