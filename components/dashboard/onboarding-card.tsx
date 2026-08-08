"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Sparkles } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface OnboardingCardProps {
  onCompleted?: () => void;
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export function OnboardingCard({ onCompleted }: OnboardingCardProps) {
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [currency, setCurrency] = useState(activeWorkspace?.currency ?? "GBP");
  const [budgetCategory, setBudgetCategory] = useState("Food & Dining");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [transactionCategory, setTransactionCategory] = useState("Food & Dining");
  const [transactionAmount, setTransactionAmount] = useState("");

  const dateRange = useMemo(() => getMonthRange(), []);

  if (!activeWorkspace) return null;

  const handleComplete = async () => {
    setSaving(true);
    try {
      const payload = {
        currency,
        budget: budgetAmount
          ? {
              category: budgetCategory,
              amount: Number.parseFloat(budgetAmount),
              period: "monthly",
              type: "expense",
              ...dateRange,
            }
          : null,
        transaction: transactionAmount
          ? {
              amount: Number.parseFloat(transactionAmount),
              date: new Date().toISOString().split("T")[0],
              type: "expense",
              category: transactionCategory,
              notes: "Created during onboarding",
            }
          : null,
      };

      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? "Failed to complete onboarding");
      }

      toast({ title: "Setup complete", description: "Your workspace is ready to use." });
      onCompleted?.();
    } catch (error) {
      toast({
        title: "Setup failed",
        description: error instanceof Error ? error.message : "Failed to complete onboarding",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          First-time setup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set your workspace currency and optionally create your first budget and transaction.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger aria-label="Workspace currency">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.code} · {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>First monthly budget (optional)</Label>
            <Input value={budgetAmount} onChange={(e) => setBudgetAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="500.00" />
          </div>

          <div className="space-y-2">
            <Label>Budget category</Label>
            <Input value={budgetCategory} onChange={(e) => setBudgetCategory(e.target.value)} placeholder="Food & Dining" />
          </div>

          <div className="space-y-2">
            <Label>First transaction amount (optional)</Label>
            <Input value={transactionAmount} onChange={(e) => setTransactionAmount(e.target.value)} type="number" min="0" step="0.01" placeholder="25.00" />
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Transaction category</Label>
            <Input value={transactionCategory} onChange={(e) => setTransactionCategory(e.target.value)} placeholder="Food & Dining" />
          </div>
        </div>

        <Button onClick={() => void handleComplete()} disabled={saving} className="h-11">
          <CheckCircle2 className="mr-2 size-4" />
          {saving ? "Saving..." : "Finish setup"}
        </Button>
      </CardContent>
    </Card>
  );
}
