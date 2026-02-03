"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TransactionForm } from "./transaction-form";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { formatCurrency, cn } from "@/lib/utils";
import type { TransactionType } from "@/types";
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, Search, SlidersHorizontal, Receipt } from "lucide-react";
import { usePaginatedQuery, useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

const PAGE_SIZE = 20;

type TypeFilter = "all" | TransactionType;

export function TransactionList() {
  const { toast } = useToast();
  const categories = useQuery(api.categories.list, {});
  const removeTransaction = useMutation(api.transactions.remove);

  const [selectedTransaction, setSelectedTransaction] = useState<Doc<"transactions"> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<Id<"transactions"> | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const queryArgs = useMemo(
    () => ({
      type: typeFilter === "all" ? undefined : typeFilter,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      search: debouncedSearch || undefined,
    }),
    [typeFilter, categoryFilter, debouncedSearch]
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
      toast({ title: "Success", description: "Transaction deleted successfully" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedTransaction(null);
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

  const handlePrev = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const filteredCategories = (categories ?? []).filter(
    (cat) => typeFilter === "all" || cat.type === typeFilter
  );

  const isLoadingFirstPage = status === "LoadingFirstPage";
  const isLoadingMore = status === "LoadingMore";
  const isLoadingNextPage = isLoadingMore && pageTransactions.length === 0;
  const canLoadMore = status === "CanLoadMore";
  const nextDisabled = isLoadingMore || (!canLoadMore && currentPage >= totalPages);
  const prevDisabled = isLoadingFirstPage || currentPage <= 1;

  return (
    <>
      <Card className="border shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold">All Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1"
              />
            </div>

            <Select
              value={typeFilter}
              onValueChange={(value: TypeFilter) => {
                setTypeFilter(value);
                setCategoryFilter("all");
              }}
            >
              <SelectTrigger className="w-full sm:w-[140px] h-10 bg-muted/50 border-0">
                <SlidersHorizontal className="size-4 mr-2 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="expense">Expenses</SelectItem>
                <SelectItem value="giving">Givings</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-muted/50 border-0">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat._id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transaction List */}
          {isLoadingFirstPage ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                  <Skeleton className="size-10 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-5 w-16" />
                </div>
              ))}
            </div>
          ) : pageTransactions.length === 0 ? (
            <div className="text-center py-16">
              <div className="size-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                <Receipt className="size-7 text-muted-foreground" />
              </div>
              <p className="font-medium">No transactions found</p>
              <p className="text-sm text-muted-foreground mt-1">
                {searchQuery || typeFilter !== "all" || categoryFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Start by adding your first transaction"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {pageTransactions.map((transaction) => (
                <div
                  key={transaction._id}
                  className="group flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors duration-150"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={cn(
                        "size-10 rounded-xl flex items-center justify-center shrink-0",
                        transaction.type === "expense"
                          ? "bg-rose-100 dark:bg-rose-900/40"
                          : "bg-emerald-100 dark:bg-emerald-900/40"
                      )}
                    >
                      {transaction.type === "expense" ? (
                        <ArrowDownRight className="size-5 text-rose-600 dark:text-rose-400" />
                      ) : (
                        <ArrowUpRight className="size-5 text-emerald-600 dark:text-emerald-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{transaction.category}</p>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide",
                            transaction.type === "expense"
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                          )}
                        >
                          {transaction.type}
                        </span>
                      </div>
                      {transaction.notes && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {transaction.notes}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(transaction.date).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p
                        className={cn(
                          "text-base font-semibold",
                          transaction.type === "expense"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {transaction.type === "expense" ? "-" : "+"}
                        {formatCurrency(transaction.amount)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg hover:bg-muted"
                      onClick={() => handleEdit(transaction)}
                    >
                      <Pencil className="size-4 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30"
                      onClick={() => handleDelete(transaction._id)}
                    >
                      <Trash2 className="size-4 text-rose-600 dark:text-rose-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {isLoadingNextPage && (
            <p className="text-xs text-muted-foreground mt-4">Loading next page...</p>
          )}

          {(pageTransactions.length > 0 || isLoadingNextPage) && (
            <div className="flex items-center justify-between mt-6">
              <Button variant="outline" size="sm" onClick={handlePrev} disabled={prevDisabled}>
                Prev
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage}{totalPages > 1 ? ` of ${totalPages}` : ""}
              </span>
              <Button variant="outline" size="sm" onClick={handleNext} disabled={nextDisabled}>
                {isLoadingMore ? "Loading..." : "Next"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={isFormOpen}
        onOpenChange={handleFormClose}
        transaction={selectedTransaction}
      />

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? This action cannot be undone."
        onConfirm={confirmDelete}
        confirmText="Delete"
        variant="destructive"
      />
    </>
  );
}
