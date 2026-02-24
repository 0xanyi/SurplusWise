"use client";

import { useCallback, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { QuickAddTransaction } from "@/components/dashboard/quick-add-transaction";

export default function TransactionsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Transactions</h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Quickly add new entries and manage your full history.
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)} className="h-11 w-full sm:w-auto">
          <Plus className="mr-2 size-4" />
          Add transaction
        </Button>
      </div>

      <QuickAddTransaction onOpenFullForm={() => setIsFormOpen(true)} onTransactionAdded={triggerRefresh} />

      <TransactionList refreshKey={refreshKey} />

      <TransactionForm open={isFormOpen} onOpenChange={setIsFormOpen} onSuccess={triggerRefresh} />
    </div>
  );
}
