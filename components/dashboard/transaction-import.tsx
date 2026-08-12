"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";
import type { ApiFinancialAccount } from "@/types";
import {
  analyzeTransactionImport,
  type TransactionImportField,
  type TransactionImportMapping,
  UNMAPPED_IMPORT_COLUMN,
} from "@/lib/transaction-import";

interface TransactionImportProps {
  onImported?: () => void;
}

interface ImportReview {
  ready: number;
  duplicates: number;
  duplicate_rows: number[];
  invalid: number;
}

const SAMPLE_CSV = `date,amount,type,category,notes
2026-03-01,45.50,expense,Food & Dining,Lunch
2026-03-02,1200.00,income,Salary,Monthly salary
2026-03-03,100.00,giving,Tithe,Sunday giving`;

const FIELD_OPTIONS: { value: TransactionImportField; label: string; required?: boolean }[] = [
  { value: "date", label: "Date", required: true },
  { value: "amount", label: "Signed amount" },
  { value: "debit", label: "Debit / money out" },
  { value: "credit", label: "Credit / money in" },
  { value: "type", label: "Type" },
  { value: "category", label: "Category" },
  { value: "notes", label: "Notes" },
  { value: "tags", label: "Tags" },
  { value: "externalId", label: "Bank reference" },
];

const NO_ACCOUNT = "__unassigned__";

export function TransactionImport({ onImported }: TransactionImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileText, setFileText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [mapping, setMapping] = useState<TransactionImportMapping>({});
  const [accountId, setAccountId] = useState(NO_ACCOUNT);
  const [review, setReview] = useState<ImportReview | null>(null);
  const { toast } = useToast();
  const { data: accountData } = useApiQuery<{ accounts: ApiFinancialAccount[] }>(
    "/api/financial-accounts",
  );
  const accounts = accountData?.accounts ?? [];

  const analysis = useMemo(() => {
    if (!fileText) return null;

    try {
      return analyzeTransactionImport(fileText, mapping);
    } catch {
      return null;
    }
  }, [fileText, mapping]);

  const handleImport = async () => {
    if (!selectedFile || !analysis) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("action", review ? "commit" : "preview");
      if (accountId !== NO_ACCOUNT) formData.append("accountId", accountId);
      for (const field of FIELD_OPTIONS) {
        const value = mapping[field.value];
        formData.append(
          `mapping:${field.value}`,
          value ?? UNMAPPED_IMPORT_COLUMN,
        );
      }

      const body = await apiFetch<ImportReview & {
        imported?: number;
        skipped?: number;
      }>("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      if (!review) {
        setReview(body);
        return;
      }

      const imported = (body as { imported?: number }).imported ?? 0;
      const skipped = (body as { skipped?: number }).skipped ?? 0;
      const duplicates = (body as { duplicates?: number }).duplicates ?? 0;

      toast({
        title: "Import complete",
        description:
          skipped + duplicates > 0
            ? `${imported} imported, ${duplicates} duplicate${duplicates === 1 ? "" : "s"} and ${skipped} invalid skipped`
            : `${imported} transactions added`,
      });

      setOpen(false);
      setSelectedFile(null);
      setFileText("");
      setMapping({});
      setReview(null);
      onImported?.();
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleFileSelected = async (file: File) => {
    try {
      const text = await file.text();
      const initialAnalysis = analyzeTransactionImport(text);
      setSelectedFile(file);
      setFileText(text);
      setMapping(initialAnalysis.mappings);
      setReview(null);
      setOpen(true);
    } catch (error) {
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Unable to read CSV",
        variant: "destructive",
      });
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const updateMapping = (field: TransactionImportField, value: string) => {
    setReview(null);
    setMapping((prev) => {
      const next = { ...prev };
      next[field] = value === UNMAPPED_IMPORT_COLUMN ? null : value;
      return next;
    });
  };

  const previewRows = analysis?.previewRows.slice(0, 6) ?? [];
  const invalidPreviewRows = previewRows.filter((row) => !row.valid);
  const missingRequiredMappings = analysis?.missingRequiredMappings ?? [];
  const canImport = !!analysis && missingRequiredMappings.length === 0 && analysis.validRowCount > 0 && !uploading;

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "sika-transactions-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload className="size-4" />
        Import CSV
      </Button>
      <Button type="button" variant="ghost" className="h-11" onClick={downloadSample}>
        <Download className="size-4" />
        Sample CSV
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFileSelected(file);
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="size-5" />
              Review CSV import
            </DialogTitle>
            <DialogDescription>
              Map a signed amount or separate debit and credit columns. Sika checks for duplicates before importing.
            </DialogDescription>
          </DialogHeader>

          {analysis && (
            <div className="space-y-6">
              <div className="grid gap-3 rounded-xl border border-border/60 p-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rows found</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{analysis.totalRows}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Ready to import</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{review?.ready ?? analysis.validRowCount}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Duplicates</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-obligation">{review?.duplicates ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Needs attention</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-expense">{analysis.invalidRowCount}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Import into account</Label>
                  <Select value={accountId} onValueChange={(value) => { setAccountId(value); setReview(null); }}>
                    <SelectTrigger aria-label="Import account">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_ACCOUNT}>Leave unassigned</SelectItem>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {FIELD_OPTIONS.map((field) => (
                  <div key={field.value} className="space-y-2">
                    <Label>{field.label}{field.required ? " *" : ""}</Label>
                    <Select
                      value={mapping[field.value] ?? UNMAPPED_IMPORT_COLUMN}
                      onValueChange={(value) => updateMapping(field.value, value)}
                    >
                      <SelectTrigger aria-label={`Column for ${field.label}`}>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={UNMAPPED_IMPORT_COLUMN}>Not mapped</SelectItem>
                        {analysis.headers.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {missingRequiredMappings.length > 0 && (
                <p className="text-sm text-expense">
                  Map required fields before importing: {missingRequiredMappings.join(", ")}
                </p>
              )}

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Preview</h3>
                  <p className="text-xs tabular-nums text-muted-foreground">Showing first {previewRows.length} rows</p>
                </div>
                <div className="overflow-x-auto rounded-xl border border-border/60">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Row</th>
                        <th className="px-3 py-2">Date</th>
                        <th className="px-3 py-2">Amount</th>
                        <th className="px-3 py-2">Type</th>
                        <th className="px-3 py-2">Category</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => (
                        <tr key={row.lineNumber} className="border-t border-border/60 align-top">
                          <td className="px-3 py-2 font-medium tabular-nums">{row.lineNumber}</td>
                          <td className="px-3 py-2">{row.normalized?.date || row.mapped.date || "-"}</td>
                          <td className="px-3 py-2 tabular-nums">{row.normalized ? formatCurrency(row.normalized.amount) : "-"}</td>
                          <td className="px-3 py-2">{row.normalized?.type || "-"}</td>
                          <td className="px-3 py-2">{row.normalized?.category || "-"}</td>
                          <td className={`px-3 py-2 ${row.valid ? "text-foreground" : "text-expense"}`}>
                            {review?.duplicate_rows.includes(row.lineNumber)
                              ? "Duplicate — skip"
                              : row.valid ? "Ready" : row.errors.join(", ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {invalidPreviewRows.length > 0 && (
                <div className="space-y-2 rounded-xl border border-expense/30 bg-expense-surface/60 p-4 text-sm text-expense">
                  <p className="font-medium">Rows with issues</p>
                  {invalidPreviewRows.map((row) => (
                    <p key={row.lineNumber}>Row {row.lineNumber}: {row.errors.join(", ")}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Cancel</Button>
            <Button type="button" onClick={() => void handleImport()} disabled={!canImport}>
              {uploading
                ? review ? "Importing..." : "Checking..."
                : review
                  ? `Import ${review.ready} new rows`
                  : "Check duplicates"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
