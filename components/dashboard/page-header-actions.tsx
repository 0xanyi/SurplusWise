"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/dashboard/transaction-form";
import { TRANSACTION_CHANGED_EVENT } from "@/lib/client-events";

/**
 * The shared app-level actions from the redesign. Search deliberately routes to
 * the transaction register, the one place where the query can be acted on,
 * while Add opens the same full transaction form from every dashboard page.
 */
export function PageHeaderActions({
  onTransactionAdded,
}: {
  onTransactionAdded?: () => void;
} = {}) {
  const [formOpen, setFormOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/dashboard/transactions#transaction-search");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  const handleTransactionAdded = () => {
    window.dispatchEvent(new Event(TRANSACTION_CHANGED_EVENT));
    onTransactionAdded?.();
  };

  return (
    <>
      <div className="flex w-full items-center gap-2 min-[860px]:w-auto">
        <Link
          href="/dashboard/transactions#transaction-search"
          className="hidden h-[38px] w-[200px] items-center gap-2 rounded-[11px] border border-border bg-card px-3 text-[13px] text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-secondary/60 hover:text-foreground min-[860px]:flex"
        >
          <Search className="size-3.5 flex-none" />
          <span>Search</span>
          <kbd className="ml-auto rounded-[5px] border border-border px-1.5 py-0.5 text-[11px] font-medium">
            ⌘K
          </kbd>
        </Link>
        <Button
          type="button"
          size="lg"
          className="flex-1 min-[860px]:flex-none"
          onClick={() => setFormOpen(true)}
        >
          <Plus />
          Add
        </Button>
      </div>

      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={handleTransactionAdded}
      />
    </>
  );
}
