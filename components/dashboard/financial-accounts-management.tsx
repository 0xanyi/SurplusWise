"use client";

import { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Plus, Trash2, WalletCards } from "lucide-react";
import { useWorkspace } from "@/contexts/workspace-context";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  ApiAccountTransfer,
  ApiFinancialAccount,
  FinancialAccountClass,
  FinancialAccountType,
} from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, StatTile } from "@/components/dashboard/panel";

interface AccountsResponse {
  accounts: ApiFinancialAccount[];
}

interface TransfersResponse {
  transfers: ApiAccountTransfer[];
}

const ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  checking: "Current / checking",
  savings: "Savings",
  cash: "Cash",
  credit_card: "Credit card",
  loan: "Loan",
  other: "Other",
};

const TYPE_CLASS: Partial<Record<FinancialAccountType, FinancialAccountClass>> = {
  checking: "asset",
  savings: "asset",
  cash: "asset",
  credit_card: "liability",
  loan: "liability",
};

const today = new Date().toISOString().slice(0, 10);

export function FinancialAccountsManagement() {
  const { activeWorkspace } = useWorkspace();
  const { toast } = useToast();
  const accountsQuery = useApiQuery<AccountsResponse>("/api/financial-accounts");
  const transfersQuery = useApiQuery<TransfersResponse>("/api/account-transfers");
  const accounts = useMemo(
    () => accountsQuery.data?.accounts ?? [],
    [accountsQuery.data?.accounts],
  );
  const transfers = transfersQuery.data?.transfers ?? [];

  const [accountOpen, setAccountOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reconcileAccount, setReconcileAccount] = useState<ApiFinancialAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({
    name: "",
    accountType: "checking" as FinancialAccountType,
    accountClass: "asset" as FinancialAccountClass,
    openingBalance: "0",
    openingDate: today,
  });
  const [transferForm, setTransferForm] = useState({
    fromAccountId: "",
    toAccountId: "",
    amount: "",
    date: today,
    notes: "",
  });
  const [reconcileForm, setReconcileForm] = useState({
    statementDate: today,
    statementBalance: "",
  });

  const totals = useMemo(() => {
    const assets = accounts
      .filter((account) => account.account_class === "asset")
      .reduce((sum, account) => sum + account.current_balance, 0);
    const liabilities = accounts
      .filter((account) => account.account_class === "liability")
      .reduce((sum, account) => sum + account.current_balance, 0);
    return { assets, liabilities, net: assets - liabilities };
  }, [accounts]);

  const accountNames = useMemo(
    () => new Map(accounts.map((account) => [account.id, account.name])),
    [accounts],
  );

  const refresh = () => {
    accountsQuery.refresh();
    transfersQuery.refresh();
  };

  const changeAccountType = (accountType: FinancialAccountType) => {
    setAccountForm((current) => ({
      ...current,
      accountType,
      accountClass: TYPE_CLASS[accountType] ?? current.accountClass,
    }));
  };

  const createAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const openingBalance = Number(accountForm.openingBalance);
    if (!Number.isFinite(openingBalance) || openingBalance < 0) {
      toast({ title: "Invalid balance", description: "Opening balance cannot be negative.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/financial-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...accountForm,
          openingBalance,
          currency: activeWorkspace?.currency ?? "GBP",
        }),
      });
      toast({ title: "Account added", description: `${accountForm.name} is ready to use.` });
      setAccountOpen(false);
      setAccountForm({
        name: "",
        accountType: "checking",
        accountClass: "asset",
        openingBalance: "0",
        openingDate: today,
      });
      refresh();
    } catch (error) {
      toast({
        title: "Could not add account",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const createTransfer = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = Number(transferForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: "Invalid amount", description: "Enter an amount above zero.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/account-transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...transferForm, amount }),
      });
      toast({ title: "Transfer recorded", description: "Both account balances have been updated." });
      setTransferOpen(false);
      setTransferForm({ fromAccountId: "", toAccountId: "", amount: "", date: today, notes: "" });
      refresh();
    } catch (error) {
      toast({
        title: "Could not record transfer",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const reconcile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reconcileAccount) return;
    const statementBalance = Number(reconcileForm.statementBalance);
    if (!Number.isFinite(statementBalance) || statementBalance < 0) {
      toast({ title: "Invalid balance", description: "Enter the balance printed on the statement.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/api/financial-accounts/${reconcileAccount.id}/reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...reconcileForm, statementBalance }),
      });
      toast({ title: "Account reconciled", description: `The ledger agrees through ${reconcileForm.statementDate}.` });
      setReconcileAccount(null);
      refresh();
    } catch (error) {
      toast({
        title: "Account does not reconcile",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const archiveAccount = async (account: ApiFinancialAccount) => {
    try {
      await apiFetch(`/api/financial-accounts/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: false }),
      });
      toast({ title: "Account archived", description: "Its history remains in the ledger." });
      refresh();
    } catch (error) {
      toast({
        title: "Could not archive account",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  const removeTransfer = async (transfer: ApiAccountTransfer) => {
    try {
      await apiFetch(`/api/account-transfers/${transfer.id}`, { method: "DELETE" });
      toast({ title: "Transfer removed" });
      refresh();
    } catch (error) {
      toast({
        title: "Could not remove transfer",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  if (accountsQuery.loading) {
    return <div className="flex justify-center py-16"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  if (accountsQuery.error) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">{accountsQuery.error}</CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Assets" value={formatCurrency(totals.assets)} />
        <StatTile label="Liabilities" value={formatCurrency(totals.liabilities)} tone={totals.liabilities > 0 ? "text-obligation" : undefined} />
        <StatTile label="Net across accounts" value={formatCurrency(totals.net)} tone={totals.net < 0 ? "text-expense" : undefined} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={() => setAccountOpen(true)}><Plus className="size-4" /> Add account</Button>
        <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={accounts.length < 2}>
          <ArrowRight className="size-4" /> Record transfer
        </Button>
      </div>

      {accounts.length === 0 ? (
        <Card>
          <CardContent className="py-4">
            <EmptyState
              icon={WalletCards}
              title="No accounts yet"
              description="Add where money is held or owed. Existing transactions stay unassigned until you choose an account."
              action={<Button onClick={() => setAccountOpen(true)}>Add your first account</Button>}
            />
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Financial accounts</CardTitle></CardHeader>
          <CardContent className="p-0">
            {accounts.map((account) => {
              const hasPending = account.projected_balance !== account.current_balance;
              return (
                <div key={account.id} className="flex flex-col gap-3 border-t border-border/60 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{account.name}</p>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] capitalize text-muted-foreground">
                        {ACCOUNT_TYPE_LABELS[account.account_type]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {account.reconciled_at
                        ? `Reconciled through ${new Date(`${account.reconciled_at}T00:00:00`).toLocaleDateString("en-GB")}`
                        : `Not reconciled · opened ${new Date(`${account.opening_date}T00:00:00`).toLocaleDateString("en-GB")}`}
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className={cn("font-display text-lg font-semibold tabular-nums", account.account_class === "liability" && account.current_balance > 0 && "text-obligation")}> 
                      {formatCurrency(account.current_balance, account.currency)}
                    </p>
                    {hasPending && <p className="text-xs text-muted-foreground">{formatCurrency(account.projected_balance, account.currency)} including pending</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReconcileForm({ statementDate: today, statementBalance: account.current_balance.toFixed(2) });
                        setReconcileAccount(account);
                      }}
                    >
                      <CheckCircle2 className="size-3.5" /> Reconcile
                    </Button>
                    <Button size="icon" variant="ghost" aria-label={`Archive ${account.name}`} onClick={() => void archiveAccount(account)}>
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {transfers.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader><CardTitle>Recent transfers</CardTitle></CardHeader>
          <CardContent className="p-0">
            {transfers.slice(0, 10).map((transfer) => (
              <div key={transfer.id} className="flex items-center gap-3 border-t border-border/60 px-5 py-3.5 sm:px-6">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {accountNames.get(transfer.from_account_id) ?? "Archived account"} → {accountNames.get(transfer.to_account_id) ?? "Archived account"}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(`${transfer.date}T00:00:00`).toLocaleDateString("en-GB")}{transfer.notes ? ` · ${transfer.notes}` : ""}</p>
                </div>
                <p className="font-semibold tabular-nums">{formatCurrency(transfer.amount)}</p>
                <Button size="icon" variant="ghost" aria-label="Delete transfer" onClick={() => void removeTransfer(transfer)}><Trash2 className="size-4" /></Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add financial account</DialogTitle>
            <DialogDescription>The opening balance is the amount held—or owed—on the opening date.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createAccount} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="account-name">Name</Label><Input id="account-name" value={accountForm.name} onChange={(e) => setAccountForm((v) => ({ ...v, name: e.target.value }))} placeholder="Main current account" required /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={accountForm.accountType} onValueChange={(value) => changeAccountType(value as FinancialAccountType)}>
                  <SelectTrigger aria-label="Account type"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Class</Label>
                <Select value={accountForm.accountClass} onValueChange={(value) => setAccountForm((v) => ({ ...v, accountClass: value as FinancialAccountClass }))} disabled={accountForm.accountType !== "other"}>
                  <SelectTrigger aria-label="Account class"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="asset">Asset</SelectItem><SelectItem value="liability">Liability</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label htmlFor="opening-balance">Opening balance</Label><Input id="opening-balance" type="number" min="0" step="0.01" value={accountForm.openingBalance} onChange={(e) => setAccountForm((v) => ({ ...v, openingBalance: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="opening-date">Opening date</Label><Input id="opening-date" type="date" value={accountForm.openingDate} onChange={(e) => setAccountForm((v) => ({ ...v, openingDate: e.target.value }))} required /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Add account</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Record transfer</DialogTitle><DialogDescription>Transfers change account balances but never count as income, expense, or giving.</DialogDescription></DialogHeader>
          <form onSubmit={createTransfer} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>From</Label><Select value={transferForm.fromAccountId} onValueChange={(value) => setTransferForm((v) => ({ ...v, fromAccountId: value }))}><SelectTrigger aria-label="From account"><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id} disabled={a.id === transferForm.toAccountId}>{a.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>To</Label><Select value={transferForm.toAccountId} onValueChange={(value) => setTransferForm((v) => ({ ...v, toAccountId: value }))}><SelectTrigger aria-label="To account"><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id} disabled={a.id === transferForm.fromAccountId}>{a.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="transfer-amount">Amount</Label><Input id="transfer-amount" type="number" min="0.01" step="0.01" value={transferForm.amount} onChange={(e) => setTransferForm((v) => ({ ...v, amount: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="transfer-date">Date</Label><Input id="transfer-date" type="date" value={transferForm.date} onChange={(e) => setTransferForm((v) => ({ ...v, date: e.target.value }))} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="transfer-notes">Notes</Label><Textarea id="transfer-notes" value={transferForm.notes} onChange={(e) => setTransferForm((v) => ({ ...v, notes: e.target.value }))} /></div>
            <DialogFooter><Button type="submit" disabled={saving || !transferForm.fromAccountId || !transferForm.toAccountId}>{saving && <Loader2 className="size-4 animate-spin" />}Record transfer</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={reconcileAccount !== null} onOpenChange={(open) => !open && setReconcileAccount(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reconcile {reconcileAccount?.name}</DialogTitle><DialogDescription>Enter the closing balance exactly as printed. Sika will confirm only when the cleared ledger agrees.</DialogDescription></DialogHeader>
          <form onSubmit={reconcile} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="statement-date">Statement date</Label><Input id="statement-date" type="date" value={reconcileForm.statementDate} onChange={(e) => setReconcileForm((v) => ({ ...v, statementDate: e.target.value }))} required /></div>
              <div className="space-y-2"><Label htmlFor="statement-balance">Closing balance</Label><Input id="statement-balance" type="number" min="0" step="0.01" value={reconcileForm.statementBalance} onChange={(e) => setReconcileForm((v) => ({ ...v, statementBalance: e.target.value }))} required /></div>
            </div>
            <DialogFooter><Button type="submit" disabled={saving}>{saving && <Loader2 className="size-4 animate-spin" />}Check and reconcile</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
