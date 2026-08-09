"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import type { TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { moneyTypeTone } from "@/lib/money-type";

interface ApiCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string | null;
}

interface QuickAddTransactionProps {
  onOpenFullForm?: (type: TransactionType) => void;
  onTransactionAdded?: () => void;
}

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "expense", label: "Expense" },
  { value: "income", label: "Income" },
  { value: "giving", label: "Giving" },
];

export function QuickAddTransaction({ onOpenFullForm, onTransactionAdded }: QuickAddTransactionProps) {
  const { toast } = useToast();
  const { data: catData } = useApiQuery<{ categories: ApiCategory[] }>("/api/categories");
  const categories = catData?.categories;

  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((item) => item.type === type),
    [categories, type]
  );

  useEffect(() => {
    if (!filteredCategories.length) {
      setCategory("");
      return;
    }

    if (!filteredCategories.some((item) => item.name === category)) {
      setCategory(filteredCategories[0].name);
    }
  }, [filteredCategories, category]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const parsedAmount = Number.parseFloat(amount);
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    if (!category) {
      toast({ title: "Error", description: "Select a category", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      await apiFetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, date, type, category }),
      });
      toast({ title: "Saved", description: "Transaction added" });
      setAmount("");
      onTransactionAdded?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add transaction";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Quick add</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* A segmented group, not a dropdown: type is the first decision on
              the entry path and it has exactly three answers, so it costs one
              tap instead of two. Each option carries its own money token, which
              is also where a user learns the colour language. */}
          <fieldset className="min-w-0">
            <legend className="sr-only">Transaction type</legend>
            <div className="flex h-11 gap-[3px] rounded-[11px] bg-secondary p-[3px]">
              {TYPE_OPTIONS.map((option) => {
                const active = type === option.value;
                const tone = moneyTypeTone(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setType(option.value)}
                    className={cn(
                      "flex flex-1 items-center justify-center rounded-[9px] px-3 text-[13px] transition-colors",
                      active
                        ? cn("font-semibold", tone.surface, tone.text)
                        : "font-medium text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

            <div className="space-y-1.5">
              <Label htmlFor="quick-amount" className="text-xs font-medium text-muted-foreground">
                Amount
              </Label>
              <Input
                id="quick-amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-11"
                required
              />
            </div>

            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="quick-category" className="text-xs font-medium text-muted-foreground">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="quick-category" className="h-11" aria-label="Category">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((item) => (
                    <SelectItem key={item.id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1.5 sm:col-span-1">
              <Label htmlFor="quick-date" className="text-xs font-medium text-muted-foreground">
                Date
              </Label>
              <Input
                id="quick-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:flex">
            <Button type="submit" disabled={loading} className="h-11 sm:w-auto">
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add quickly
            </Button>
            {onOpenFullForm && (
              <Button type="button" variant="outline" className="h-11" onClick={() => onOpenFullForm(type)}>
                Open full form
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
