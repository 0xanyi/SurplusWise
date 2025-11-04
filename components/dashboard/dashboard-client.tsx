"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { Plus, Upload, Camera } from "lucide-react";

export function DashboardClient() {
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isGivingFormOpen, setIsGivingFormOpen] = useState(false);
  const [transactionListKey, setTransactionListKey] = useState(0);

  const handleTransactionSuccess = () => {
    // Force refresh of transaction list
    setTransactionListKey(prev => prev + 1);
  };

  return (
    <>
      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setIsExpenseFormOpen(true)}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-2 font-medium">
                <Plus className="h-5 w-5 text-red-600 group-hover:scale-110 transition-transform" />
                Add Expense
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Track your spending
              </div>
            </button>

            <button
              onClick={() => setIsGivingFormOpen(true)}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <div className="flex items-center gap-2 font-medium">
                <Plus className="h-5 w-5 text-green-600 group-hover:scale-110 transition-transform" />
                Add Giving
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Record tithes & offerings
              </div>
            </button>

            <button
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left group opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="flex items-center gap-2 font-medium">
                <Camera className="h-5 w-5 text-purple-600" />
                Scan Receipt
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                Coming soon
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Transaction List */}
      <TransactionList key={transactionListKey} />

      {/* Transaction Forms */}
      <TransactionForm
        open={isExpenseFormOpen}
        onOpenChange={setIsExpenseFormOpen}
        defaultType="expense"
        onSuccess={handleTransactionSuccess}
      />

      <TransactionForm
        open={isGivingFormOpen}
        onOpenChange={setIsGivingFormOpen}
        defaultType="giving"
        onSuccess={handleTransactionSuccess}
      />
    </>
  );
}
