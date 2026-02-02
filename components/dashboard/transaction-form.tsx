"use client";

import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Camera, Edit3, X, Sparkles, Receipt, DollarSign, Calendar, Tag, FileText } from "lucide-react";
import { ReceiptScanner } from "./receipt-scanner";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect } from "react";

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
  const [mode, setMode] = useState<'manual' | 'scan'>('manual');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: transaction?.amount?.toString() || '',
    date: transaction?.date || new Date().toISOString().split('T')[0],
    type: transaction?.type || defaultType,
    category: transaction?.category || '',
    notes: transaction?.notes || '',
  });

  const categories = useQuery(api.categories.list, {});

  useEffect(() => {
    if (open) {
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

  const filteredCategories = (categories ?? []).filter(cat => cat.type === formData.type);

  const handleReceiptScan = (data: any) => {
    setFormData({
      amount: data.amount?.toString() || '',
      date: data.date || new Date().toISOString().split('T')[0],
      type: 'expense',
      category: data.category || '',
      notes: data.vendor ? `Vendor: ${data.vendor}` : '',
    });
    setReceiptUrl(data.receiptUrl);
    setMode('manual');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const url = transaction?.id
        ? `/api/transactions/${transaction.id}`
        : '/api/transactions';

      const method = transaction?.id ? 'PATCH' : 'POST';

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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2",
            "max-h-[90vh] overflow-y-auto",
            "rounded-2xl border border-white/10",
            "bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950",
            "shadow-2xl shadow-black/50",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%]",
            "data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
          )}
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none" />
          
          <DialogPrimitive.Close className="absolute right-4 top-4 z-10 rounded-full p-2 text-white/60 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50">
            <X className="size-5" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>

          <div className="relative p-6">
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/25">
                  <Sparkles className="size-5 text-white" />
                </div>
                <DialogPrimitive.Title className="text-xl font-semibold text-white">
                  {transaction?.id ? 'Edit Transaction' : 'Add Transaction'}
                </DialogPrimitive.Title>
              </div>
              <DialogPrimitive.Description className="text-sm text-slate-400 pl-[52px]">
                {transaction?.id
                  ? 'Update the transaction details below'
                  : 'Fill in the details or scan a receipt'}
              </DialogPrimitive.Description>
            </div>

            {!transaction?.id && (
              <div className="mb-6 p-1.5 bg-slate-800/80 rounded-xl border border-white/5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('manual')}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                      mode === 'manual'
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Edit3 className="size-4" />
                    Manual Entry
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('scan')}
                    className={cn(
                      "flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                      mode === 'scan'
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25"
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Camera className="size-4" />
                    Scan Receipt
                  </button>
                </div>
              </div>
            )}

            {mode === 'scan' && !transaction?.id ? (
              <ReceiptScanner
                onScanComplete={handleReceiptScan}
                onCancel={() => setMode('manual')}
              />
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Receipt className="size-4 text-slate-500" />
                    Type
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: 'expense' | 'giving') =>
                      setFormData({ ...formData, type: value, category: '' })
                    }
                  >
                    <SelectTrigger className="h-12 bg-slate-800/50 border-white/10 text-white rounded-xl hover:border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                      <SelectItem value="expense" className="focus:bg-white/10 focus:text-white">Expense</SelectItem>
                      <SelectItem value="giving" className="focus:bg-white/10 focus:text-white">Giving</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <DollarSign className="size-4 text-slate-500" />
                    Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="0.00"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      required
                      className="h-12 pl-8 bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-xl hover:border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Calendar className="size-4 text-slate-500" />
                    Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="h-12 bg-slate-800/50 border-white/10 text-white rounded-xl hover:border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <Tag className="size-4 text-slate-500" />
                    Category
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                  >
                    <SelectTrigger className="h-12 bg-slate-800/50 border-white/10 text-white rounded-xl hover:border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-white/10 text-white">
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat._id} value={cat.name} className="focus:bg-white/10 focus:text-white">
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                    <FileText className="size-4 text-slate-500" />
                    Notes <span className="text-slate-500 font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any additional notes..."
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={3}
                    className="bg-slate-800/50 border-white/10 text-white placeholder:text-slate-600 rounded-xl hover:border-white/20 focus:border-blue-500/50 focus:ring-blue-500/20 transition-colors resize-none"
                  />
                </div>

                {receiptUrl && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-sm text-emerald-400">Receipt attached</span>
                  </div>
                )}

                <div className="flex gap-3 pt-4 border-t border-white/5">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={loading}
                    className="flex-1 h-12 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 border border-white/10"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={loading}
                    className="flex-1 h-12 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium shadow-lg shadow-blue-500/25 border-0 transition-all duration-200"
                  >
                    {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                    {transaction?.id ? 'Update' : 'Create Transaction'}
                  </Button>
                </div>
              </form>
            )}
          </div>
          
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
