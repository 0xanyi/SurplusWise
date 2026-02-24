"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Loader2, Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface QuickAddTransactionProps {
  onOpenFullForm?: (type: TransactionType) => void;
}

export function QuickAddTransaction({ onOpenFullForm }: QuickAddTransactionProps) {
  const { toast } = useToast();
  const categories = useQuery(api.categories.list, {});
  const createTransaction = useMutation(api.transactions.create);

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
      await createTransaction({ amount: parsedAmount, date, type, category });
      toast({ title: "Saved", description: "Transaction added" });
      setAmount("");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add transaction";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Quick add</CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <div className="space-y-1">
              <Label htmlFor="quick-type" className="text-xs text-muted-foreground">
                Type
              </Label>
              <Select value={type} onValueChange={(value: TransactionType) => setType(value)}>
                <SelectTrigger id="quick-type" className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="giving">Giving</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="quick-amount" className="text-xs text-muted-foreground">
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

            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label htmlFor="quick-category" className="text-xs text-muted-foreground">
                Category
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="quick-category" className="h-11">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((item) => (
                    <SelectItem key={item._id} value={item.name}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 space-y-1 sm:col-span-1">
              <Label htmlFor="quick-date" className="text-xs text-muted-foreground">
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
              {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Plus className="mr-2 size-4" />}
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
