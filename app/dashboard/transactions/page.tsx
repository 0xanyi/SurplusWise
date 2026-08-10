"use client";

import { useCallback, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageHeaderActions } from "@/components/dashboard/page-header-actions";
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
        actions={<PageHeaderActions onTransactionAdded={triggerRefresh} />}
      />

      <QuickAddTransaction onOpenFullForm={() => setIsFormOpen(true)} onTransactionAdded={triggerRefresh} />

      <TransactionImport onImported={triggerRefresh} />

      <TransactionList refreshKey={refreshKey} />

      <TransactionForm open={isFormOpen} onOpenChange={setIsFormOpen} onSuccess={triggerRefresh} />
    </div>
  );
}
