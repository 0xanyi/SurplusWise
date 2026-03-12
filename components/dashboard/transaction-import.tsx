"use client";

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface TransactionImportProps {
  onImported?: () => void;
}

const SAMPLE_CSV = `date,amount,type,category,notes
2026-03-01,45.50,expense,Food & Dining,Lunch
2026-03-02,1200.00,income,Salary,Monthly salary
2026-03-03,100.00,giving,Tithe,Sunday giving`;

export function TransactionImport({ onImported }: TransactionImportProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleImport = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transactions/import", {
        method: "POST",
        body: formData,
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((body as { error?: string }).error ?? "Failed to import CSV");
      }

      toast({ title: "Import complete", description: `${(body as { imported?: number }).imported ?? 0} transactions added` });
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

  const downloadSample = () => {
    const blob = new Blob([SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "surpluswise-transactions-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Button type="button" variant="outline" className="h-11" onClick={() => inputRef.current?.click()} disabled={uploading}>
        <Upload className="mr-2 size-4" />
        {uploading ? "Importing..." : "Import CSV"}
      </Button>
      <Button type="button" variant="ghost" className="h-11" onClick={downloadSample}>
        <Download className="mr-2 size-4" />
        Sample CSV
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImport(file);
        }}
      />
    </div>
  );
}
