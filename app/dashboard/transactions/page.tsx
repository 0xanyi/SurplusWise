"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/dashboard/page-header";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { QuickAddTransaction } from "@/components/dashboard/quick-add-transaction";
import { TransactionImport } from "@/components/dashboard/transaction-import";

export default function TransactionsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col gap-[18px] pb-4">
      <PageHeader
        kicker="Money in & out"
        title="Transactions"
        description="Quickly add new entries and manage your full history."
        actions={
          <Button onClick={() => setIsFormOpen(true)} className="w-full sm:w-auto">
            <Plus />
            Add transaction
          </Button>
        }
      />

      <QuickAddTransaction onOpenFullForm={() => setIsFormOpen(true)} onTransactionAdded={triggerRefresh} />

      <TransactionImport onImported={triggerRefresh} />

      <TransactionList refreshKey={refreshKey} />

      <TransactionForm open={isFormOpen} onOpenChange={setIsFormOpen} onSuccess={triggerRefresh} />
    </div>
  );
}
