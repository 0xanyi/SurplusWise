"use client";

import type { InvestmentType } from "@/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  stock: "Stock",
  crypto: "Crypto",
  forex: "Forex",
  property: "Property",
  business: "Business",
  savings: "Savings",
  other: "Other",
};

export interface InvestmentFormData {
  name: string;
  investmentType: InvestmentType;
  platform: string;
  costBasis: string;
  currentValue: string;
  quantity: string;
  purchaseDate: string;
  notes: string;
}

interface InvestmentFormFieldsProps {
  formData: InvestmentFormData;
  onChange: (updates: Partial<InvestmentFormData>) => void;
}

export function InvestmentFormFields({ formData, onChange }: InvestmentFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="inv-name">Name</Label>
        <Input
          id="inv-name"
          placeholder='e.g. "Tesla Stock", "Bitcoin"'
          value={formData.name}
          onChange={(e) => onChange({ name: e.target.value })}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-type">Type</Label>
        <Select
          value={formData.investmentType}
          onValueChange={(val) =>
            onChange({ investmentType: val as InvestmentType })
          }
        >
          <SelectTrigger id="inv-type" aria-label="Investment type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(INVESTMENT_TYPE_LABELS) as [InvestmentType, string][]).map(
              ([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ),
            )}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-platform">Platform (optional)</Label>
        <Input
          id="inv-platform"
          placeholder='e.g. "Trading212", "Binance"'
          value={formData.platform}
          onChange={(e) => onChange({ platform: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="inv-cost-basis">Cost Basis</Label>
          <Input
            id="inv-cost-basis"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.costBasis}
            onChange={(e) => onChange({ costBasis: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-current-value">Current Value</Label>
          <Input
            id="inv-current-value"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={formData.currentValue}
            onChange={(e) => onChange({ currentValue: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="inv-quantity">Quantity / Units (optional)</Label>
          <Input
            id="inv-quantity"
            type="number"
            min="0"
            step="any"
            placeholder="e.g. 10"
            value={formData.quantity}
            onChange={(e) => onChange({ quantity: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inv-purchase-date">Purchase Date</Label>
          <Input
            id="inv-purchase-date"
            type="date"
            value={formData.purchaseDate}
            onChange={(e) => onChange({ purchaseDate: e.target.value })}
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="inv-notes">Notes (optional)</Label>
        <Input
          id="inv-notes"
          placeholder="e.g. Long-term hold"
          value={formData.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
        />
      </div>
    </>
  );
}
