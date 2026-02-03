"use client";

import { useState } from "react";
import { TransactionForm } from "./transaction-form";
import { TrendingDown, TrendingUp, ScanLine, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardClient() {
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [isGivingFormOpen, setIsGivingFormOpen] = useState(false);

  const handleTransactionSuccess = () => {};

  const QuickActionCard = ({
    title,
    description,
    icon: Icon,
    onClick,
    colorClass,
    bgClass,
  }: {
    title: string;
    description: string;
    icon: any;
    onClick: () => void;
    colorClass: string;
    bgClass: string;
  }) => (
    <button
      onClick={onClick}
      className="relative overflow-hidden p-6 rounded-2xl border border-border/50 bg-card hover:bg-accent/50 hover:border-primary/20 transition-all duration-300 group text-left w-full h-full"
    >
      <div className={cn("absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity", colorClass)}>
        <Icon className="w-24 h-24 -mr-8 -mt-8" />
      </div>
      
      <div className="relative z-10 flex flex-col h-full justify-between">
        <div className="flex items-start justify-between mb-4">
          <div className={cn("p-3 rounded-xl", bgClass)}>
            <Icon className={cn("w-6 h-6", colorClass)} />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all duration-300">
            <ArrowRight className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold text-lg mb-1 group-hover:text-primary transition-colors">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
    </button>
  );

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickActionCard
          title="Add Expense"
          description="Log a new expense manually"
          icon={TrendingDown}
          onClick={() => setIsExpenseFormOpen(true)}
          colorClass="text-rose-500"
          bgClass="bg-rose-500/10"
        />
        
        <QuickActionCard
          title="Add Giving"
          description="Record tithes & offerings"
          icon={TrendingUp}
          onClick={() => setIsGivingFormOpen(true)}
          colorClass="text-emerald-500"
          bgClass="bg-emerald-500/10"
        />

        <QuickActionCard
          title="Scan Receipt"
          description="AI-powered receipt scanning"
          icon={ScanLine}
          onClick={() => {
             // For now, open expense form in scan mode if possible, 
             // or just open expense form and user switches to scan.
             // Ideally pass a prop to start in scan mode.
             setIsExpenseFormOpen(true); 
          }}
          colorClass="text-blue-500"
          bgClass="bg-blue-500/10"
        />
      </div>

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
