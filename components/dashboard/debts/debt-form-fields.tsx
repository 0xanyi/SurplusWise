"use client";

import type { ApiFinancialAccount, DebtType } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card",
  loan: "Loan",
  mortgage: "Mortgage",
  overdraft: "Overdraft",
  other: "Other",
};

export interface DebtFormData {
  name: string;
  debtType: DebtType;
  financialAccountId: string;
  lender: string;
  currentBalance: string;
  creditLimit: string;
  interestRate: string;
  minimumPayment: string;
  minPaymentPercent: string;
  minPaymentFloor: string;
  paymentDayOfMonth: string;
  startDate: string;
  endDate: string;
  notes: string;
}

interface DebtFormFieldsProps {
  formData: DebtFormData;
  liabilityAccounts: ApiFinancialAccount[];
  onChange: (updates: Partial<DebtFormData>) => void;
}

export function DebtFormFields({
  formData,
  liabilityAccounts,
  onChange,
}: DebtFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="debt-name">Name</Label>
          <Input
            id="debt-name"
            placeholder="e.g. Barclays Credit Card"
            value={formData.name}
            onChange={(e) => onChange({ name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-type">Type</Label>
          <Select
            value={formData.debtType}
            onValueChange={(value: DebtType) => onChange({ debtType: value })}
          >
            <SelectTrigger id="debt-type" aria-label="Debt type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DEBT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="debt-financial-account">Liability account (optional)</Label>
        <Select
          value={formData.financialAccountId || "unlinked"}
          onValueChange={(value) => onChange({
            financialAccountId: value === "unlinked" ? "" : value,
          })}
        >
          <SelectTrigger id="debt-financial-account" aria-label="Linked liability account">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unlinked">Not linked</SelectItem>
            {liabilityAccounts.map((account) => (
              <SelectItem
                key={account.id}
                value={account.id}
                disabled={!account.is_active && account.id !== formData.financialAccountId}
              >
                {account.name}{account.is_active ? "" : " (archived)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11.5px] text-muted-foreground">
          Link the account that carries this balance so net worth counts the liability once.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="debt-lender">Lender</Label>
          <Input
            id="debt-lender"
            placeholder="e.g. Barclays"
            value={formData.lender}
            onChange={(e) => onChange({ lender: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-balance">Current Balance</Label>
          <Input
            id="debt-balance"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.currentBalance}
            onChange={(e) => onChange({ currentBalance: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {formData.debtType === "credit_card" && (
          <div className="space-y-2">
            <Label htmlFor="debt-limit">Credit Limit</Label>
            <Input
              id="debt-limit"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={formData.creditLimit}
              onChange={(e) => onChange({ creditLimit: e.target.value })}
            />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="debt-rate">APR % (as advertised)</Label>
          <Input
            id="debt-rate"
            type="number"
            min="0"
            max="100"
            step="0.01"
            placeholder="0.00"
            value={formData.interestRate}
            onChange={(e) => onChange({ interestRate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-minpay">Min. Payment</Label>
          <Input
            id="debt-minpay"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.minimumPayment}
            onChange={(e) => onChange({ minimumPayment: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-payday">Payment Day</Label>
          <Input
            id="debt-payday"
            type="number"
            min="1"
            max="31"
            placeholder="1-31"
            value={formData.paymentDayOfMonth}
            onChange={(e) => onChange({ paymentDayOfMonth: e.target.value })}
          />
        </div>
      </div>

      {(formData.debtType === "credit_card" || formData.debtType === "overdraft") && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="debt-minpct">Minimum % of balance</Label>
            <Input
              id="debt-minpct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="1.00"
              value={formData.minPaymentPercent}
              onChange={(e) => onChange({ minPaymentPercent: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="debt-minfloor">Minimum floor</Label>
            <Input
              id="debt-minfloor"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 25.00"
              value={formData.minPaymentFloor}
              onChange={(e) => onChange({ minPaymentFloor: e.target.value })}
            />
          </div>
          <p className="col-span-2 text-[11.5px] text-muted-foreground">
            Used to estimate the next minimum before a statement is recorded:
            interest and fees plus this percentage of the balance, never below the
            floor. A statement&apos;s own minimum always wins.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="debt-start">Start Date</Label>
          <Input
            id="debt-start"
            type="date"
            value={formData.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="debt-end">Expected End Date</Label>
          <Input
            id="debt-end"
            type="date"
            value={formData.endDate}
            onChange={(e) => onChange({ endDate: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="debt-notes">Notes (optional)</Label>
        <Input
          id="debt-notes"
          placeholder="Any extra details..."
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </>
  );
}
