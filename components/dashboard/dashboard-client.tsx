"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TransactionForm } from "./transaction-form";
import { TransactionList } from "./transaction-list";
import { Plus, Camera, TrendingDown, TrendingUp } from "lucide-react";

export function DashboardClient() {
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isGivingFormOpen, setIsGivingFormOpen] = useState(false);
  const [transactionListKey, setTransactionListKey] = useState(0);

  const handleTransactionSuccess = () => {
    setTransactionListKey(prev => prev + 1);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setIsExpenseFormOpen(true)}
              className="p-5 border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
                  <TrendingDown className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <div className="font-semibold">Add Expense</div>
                  <div className="text-sm text-muted-foreground">
                    Track your spending
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setIsGivingFormOpen(true)}
              className="p-5 border border-border rounded-xl hover:bg-accent hover:border-primary/30 transition-all duration-200 text-left group"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="font-semibold">Add Giving</div>
                  <div className="text-sm text-muted-foreground">
                    Record tithes & offerings
                  </div>
                </div>
              </div>
            </button>

            <button
              className="p-5 border border-border rounded-xl text-left group opacity-60 cursor-not-allowed"
              disabled
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Camera className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <div className="font-semibold">Scan Receipt</div>
                  <div className="text-sm text-muted-foreground">
                    Coming soon
                  </div>
                </div>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      <TransactionList key={transactionListKey} />

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
