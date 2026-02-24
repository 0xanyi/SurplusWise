"use client";

import { useState } from "react";
import { ScanLine } from "lucide-react";
import type { TransactionType } from "@/types";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { QuickAddTransaction } from "./quick-add-transaction";

export function DashboardClient() {
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<TransactionType>("expense");
  const [formMode, setFormMode] = useState<"manual" | "scan">("manual");

  const openForm = (type: TransactionType, mode: "manual" | "scan" = "manual") => {
    setFormType(type);
    setFormMode(mode);
    setFormOpen(true);
  };

  return (
    <>
      <div className="space-y-3">
        <QuickAddTransaction onOpenFullForm={(type) => openForm(type, "manual")} />

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => openForm("expense", "scan")}>
            <ScanLine className="mr-2 size-4" />
            Scan receipt
          </Button>
        </div>
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        defaultType={formType}
        defaultMode={formMode}
      />
    </>
  );
}
