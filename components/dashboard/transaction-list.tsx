"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ArrowDownRight, ArrowUpRight, Pencil, Receipt, Search, Trash2, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionForm } from "./transaction-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

const PAGE_SIZE = 20;

type TypeFilter = "all" | TransactionType;

const typeFilterOptions: { label: string; value: TypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Income", value: "income" },
  { label: "Expense", value: "expense" },
  { label: "Giving", value: "giving" },
];

export function TransactionList() {
  const { toast } = useToast();
  const removeTransaction = useMutation(api.transactions.remove);

  const [selectedTransaction, setSelectedTransaction] = useState<Doc<"transactions"> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [deleteId, setDeleteId] = useState<Id<"transactions"> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 250);

  const queryArgs = useMemo(
    () => ({
      type: typeFilter === "all" ? undefined : typeFilter,
      search: debouncedSearch || undefined,
    }),
    [typeFilter, debouncedSearch]
  );

  const { results, status, loadMore } = usePaginatedQuery(
    api.transactions.listPaginated,
    queryArgs,
    { initialNumItems: PAGE_SIZE }
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [queryArgs]);

  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pageTransactions = results.slice(pageStart, pageStart + PAGE_SIZE);

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const isLoadingNextPage = isLoadingMore && pageTransactions.length === 0;
  const canLoadMore = status === "CanLoadMore";

  const handleEdit = (transaction: Doc<"transactions">) => {
    setSelectedTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDelete = (id: Id<"transactions">) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;

    try {
      await removeTransaction({ id: deleteId });
      toast({ title: "Success", description: "Transaction deleted" });
    } catch {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleNext = () => {
    const nextPage = currentPage + 1;

    if (nextPage <= totalPages) {
      setCurrentPage(nextPage);
      return;
    }

    if (status === "CanLoadMore") {
      loadMore(PAGE_SIZE);
      setCurrentPage(nextPage);
    }
  };

  const getIcon = (type: TransactionType) => {
    if (type === "expense") return <ArrowDownRight className="size-5 text-rose-600" />;
    if (type === "income") return <TrendingUp className="size-5 text-blue-600" />;
    return <ArrowUpRight className="size-5 text-emerald-600" />;
  };

  const getIconBg = (type: TransactionType) => {
    if (type === "expense") return "bg-rose-100 dark:bg-rose-900/30";
    if (type === "income") return "bg-blue-100 dark:bg-blue-900/30";
    return "bg-emerald-100 dark:bg-emerald-900/30";
  };

  const getAmountColor = (type: TransactionType) => {
    if (type === "expense") return "text-rose-600";
    if (type === "income") return "text-blue-600";
    return "text-emerald-600";
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">All transactions</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="mb-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search category or notes"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {typeFilterOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  size="sm"
                  variant={typeFilter === option.value ? "default" : "outline"}
                  onClick={() => setTypeFilter(option.value)}
                  className="h-10"
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>

          {isLoadingFirstPage ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
                  <Skeleton className="size-10 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : pageTransactions.length === 0 ? (
            <div className="py-12 text-center">
              <Receipt className="mx-auto mb-2 size-7 text-muted-foreground" />
              <p className="font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground">Try another filter or search term.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pageTransactions.map((transaction) => (
                <div key={transaction._id} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={cn("mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg", getIconBg(transaction.type))}>
                        {getIcon(transaction.type)}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium sm:text-base">{transaction.category}</p>
                        <p className="text-xs text-muted-foreground sm:text-sm">
                          {transaction.type} • {new Date(transaction.date).toLocaleDateString("en-GB")}
                        </p>
                        {transaction.notes && (
                          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground sm:text-sm">{transaction.notes}</p>
                        )}
                      </div>
                    </div>

                    <p className={cn("shrink-0 text-sm font-semibold sm:text-base", getAmountColor(transaction.type))}>
                      {transaction.type === "expense" ? "-" : "+"}
                      {formatCurrency(transaction.amount)}
                    </p>
                  </div>

                  <div className="mt-3 flex gap-2 sm:justify-end">
                    <Button type="button" size="sm" variant="outline" className="h-9 flex-1 sm:flex-none" onClick={() => handleEdit(transaction)}>
                      <Pencil className="mr-2 size-4" />
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 sm:flex-none"
                      onClick={() => handleDelete(transaction._id)}
                    >
                      <Trash2 className="mr-2 size-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoadingNextPage && <p className="mt-3 text-xs text-muted-foreground">Loading next page...</p>}

          {(pageTransactions.length > 0 || isLoadingNextPage) && (
            <div className="mt-5 flex items-center justify-between">
              <Button variant="outline" size="sm" className="h-9" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1 || isLoadingFirstPage}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage}{totalPages > 1 ? ` of ${totalPages}` : ""}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-9"
                onClick={handleNext}
                disabled={isLoadingMore || (!canLoadMore && currentPage >= totalPages)}
              >
                {isLoadingMore ? "Loading..." : "Next"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setSelectedTransaction(null);
        }}
        transaction={selectedTransaction}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={confirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
