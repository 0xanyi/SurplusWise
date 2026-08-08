"use client";

import type { DebtType } from "@/types";
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
  lender: string;
  currentBalance: string;
  creditLimit: string;
  interestRate: string;
  minimumPayment: string;
  paymentDayOfMonth: string;
  startDate: string;
  endDate: string;
  notes: string;
}

interface DebtFormFieldsProps {
  formData: DebtFormData;
  onChange: (updates: Partial<DebtFormData>) => void;
}

export function DebtFormFields({ formData, onChange }: DebtFormFieldsProps) {
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
          <Label htmlFor="debt-rate">APR %</Label>
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
