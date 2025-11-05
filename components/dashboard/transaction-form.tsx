"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Edit3 } from "lucide-react";
import { ReceiptScanner } from "./receipt-scanner";

interface Category {
  id: string;
  name: string;
  type: 'expense' | 'giving';
  color: string;
}

interface Transaction {
  id?: string;
  amount: number;
  date: string;
  type: 'expense' | 'giving';
  category: string;
  notes?: string | null;
  receipt_url?: string | null;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction | null;
  onSuccess?: () => void;
  defaultType?: 'expense' | 'giving';
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  onSuccess,
  defaultType = 'expense'
}: TransactionFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode, setMode] = useState<'manual' | 'scan'>('manual');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: transaction?.amount?.toString() || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    type: transaction?.type || defaultType,
    category: transaction?.category || '',
    notes: transaction?.notes || '',
  });

  // Fetch categories when dialog opens
  useEffect(() => {
    if (open) {
      fetchCategories();
      if (transaction) {
        setFormData({
          amount: transaction.amount.toString(),
          date: transaction.date,
          type: transaction.type,
          category: transaction.category,
          notes: transaction.notes || '',
        });
        setReceiptUrl(transaction.receipt_url || null);
        setMode('manual');
      } else {
        setFormData({
          amount: '',
          date: new Date().toISOString().split('T')[0],
          type: defaultType,
          category: '',
          notes: '',
        });
        setReceiptUrl(null);
        setMode('manual');
      }
    }
  }, [open, transaction, defaultType]);

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const filteredCategories = categories.filter(cat => cat.type === formData.type);

  const handleReceiptScan = (data: any) => {
    setFormData({
      amount: data.amount?.toString() || '',
      date: data.date || new Date().toISOString().split('T')[0],
      type: 'expense',
      category: data.category || '',
      notes: data.vendor ? `Vendor: ${data.vendor}` : '',
    });
    setReceiptUrl(data.receiptUrl);
    setMode('manual'); // Switch to manual mode to review/edit
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = transaction?.id
        ? `/api/transactions/${transaction.id}`
        : '/api/transactions';

      const method = transaction?.id ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          receipt_url: receiptUrl,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save transaction');
      }

      toast({
        title: "Success",
        description: `Transaction ${transaction?.id ? 'updated' : 'created'} successfully`,
      });

      onOpenChange(false);
      if (onSuccess) onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save transaction",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction?.id ? 'Edit Transaction' : 'Add Transaction'}
          </DialogTitle>
          <DialogDescription>
            {transaction?.id
              ? 'Update the transaction details below'
              : 'Fill in the details to add a new transaction or scan a receipt'}
          </DialogDescription>
        </DialogHeader>

        {!transaction?.id && (
          <div className="flex gap-2 border-b pb-4">
            <Button
              type="button"
              variant={mode === 'manual' ? 'default' : 'outline'}
              onClick={() => setMode('manual')}
              className="flex-1"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Manual Entry
            </Button>
            <Button
              type="button"
              variant={mode === 'scan' ? 'default' : 'outline'}
              onClick={() => setMode('scan')}
              className="flex-1"
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan Receipt
            </Button>
          </div>
        )}

        {mode === 'scan' && !transaction?.id ? (
          <ReceiptScanner
            onScanComplete={handleReceiptScan}
            onCancel={() => setMode('manual')}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value: 'expense' | 'giving') =>
                setFormData({ ...formData, type: value, category: '' })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="giving">Giving</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>

          {receiptUrl && (
            <div className="text-sm text-muted-foreground">
              ✓ Receipt attached
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {transaction?.id ? 'Update' : 'Create'}
            </Button>
          </div>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
