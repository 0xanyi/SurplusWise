"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LoanFormData {
  borrowerName: string;
  amount: string;
  loanDate: string;
  expectedPaybackDate: string;
  interestRate: string;
  notes: string;
}

interface LoanFormFieldsProps {
  formData: LoanFormData;
  onChange: (updates: Partial<LoanFormData>) => void;
}

export function LoanFormFields({ formData, onChange }: LoanFormFieldsProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="loan-borrower">Borrower Name</Label>
        <Input
          id="loan-borrower"
          placeholder="e.g. John Smith"
          value={formData.borrowerName}
          onChange={(e) => onChange({ borrowerName: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loan-amount">Amount</Label>
        <Input
          id="loan-amount"
          type="number"
          min="0.01"
          step="0.01"
          placeholder="0.00"
          value={formData.amount}
          onChange={(e) => onChange({ amount: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loan-date">Loan Date</Label>
        <Input
          id="loan-date"
          type="date"
          value={formData.loanDate}
          onChange={(e) => onChange({ loanDate: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loan-payback-date">Expected Payback Date (optional)</Label>
        <Input
          id="loan-payback-date"
          type="date"
          value={formData.expectedPaybackDate}
          onChange={(e) => onChange({ expectedPaybackDate: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="loan-interest">Monthly interest rate % (optional)</Label>
        <Input
          id="loan-interest"
          type="number"
          min="0"
          max="100"
          step="0.01"
          placeholder="0.00"
          value={formData.interestRate}
          onChange={(e) => onChange({ interestRate: e.target.value })}
          aria-describedby="loan-interest-hint"
        />
        <p id="loan-interest-hint" className="text-xs text-muted-foreground">
          Charged per month on the outstanding balance, never compounded. Leave
          blank for an interest-free loan.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="loan-notes">Notes (optional)</Label>
        <Input
          id="loan-notes"
          placeholder="e.g. Emergency loan, cash"
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </div>
  );
}
