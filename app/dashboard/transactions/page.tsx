"use client";

 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { TransactionForm } from "@/components/dashboard/transaction-form";
 import { TransactionList } from "@/components/dashboard/transaction-list";
 import { Plus } from "lucide-react";

 export default function TransactionsPage() {
   const [isFormOpen, setIsFormOpen] = useState(false);

   return (
     <div className="space-y-6 pb-6">
       {/* Page Header */}
       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
         <div>
           <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Transactions</h1>
           <p className="text-muted-foreground mt-1">
             View and manage all your income, expenses, and givings
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

       <TransactionList />

       <TransactionForm
         open={isFormOpen}
         onOpenChange={setIsFormOpen}
       />
     </div>
   );
 }
