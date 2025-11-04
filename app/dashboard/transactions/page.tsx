"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { Plus } from "lucide-react";

export default function TransactionsPage() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [transactionListKey, setTransactionListKey] = useState(0);

  const handleTransactionSuccess = () => {
    setTransactionListKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your expenses and givings
          </p>
        </div>
        <Button onClick={() => setIsFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      <TransactionList key={transactionListKey} />

      <TransactionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleTransactionSuccess}
      />
    </div>
  );
}
