import { ClientsManagement } from "@/components/dashboard/clients/clients-management";
import { ClientsPageHeader } from "@/components/dashboard/clients/clients-page-header";

export default function ClientsPage() {
  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <ClientsPageHeader />
      <ClientsManagement />
    </div>
  );
}
