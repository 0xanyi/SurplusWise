"use client";
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
       {/* Page Header */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
           <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Transactions</h1>
           <p className="text-muted-foreground mt-1">
             View and manage all your expenses and givings
           </p>
         </div>
         <Button 
           onClick={() => setIsFormOpen(true)}
           className="shadow-sm w-full sm:w-auto"
         >
           <Plus className="size-4 mr-2" />
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