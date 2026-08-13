"use client";

import { useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiFetch, apiFetchBlob, useApiQuery } from "@/hooks/use-api";
import { useToast } from "@/hooks/use-toast";
import { TRANSACTION_CHANGED_EVENT } from "@/lib/client-events";
import type { ApiTransactionDocument } from "@/types";

interface DocumentsResponse {
  documents: ApiTransactionDocument[];
  storage_configured: boolean;
}

function formatSize(bytes: number | null) {
  if (bytes === null) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function GivingSupportingDocuments({ transactionId }: { transactionId: string }) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const query = useApiQuery<DocumentsResponse>(`/api/transactions/${transactionId}/documents`);
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiFetch(`/api/transactions/${transactionId}/documents`, {
        method: "POST",
        body: formData,
      });
      query.refresh();
      window.dispatchEvent(new Event(TRANSACTION_CHANGED_EVENT));
      toast({ title: "Supporting document added" });
    } catch (error) {
      toast({
        title: "Could not upload document",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (document: ApiTransactionDocument) => {
    setDownloadingId(document.id);
    try {
      const blob = await apiFetchBlob(document.download_url);
      const url = URL.createObjectURL(blob);
      const anchor = window.document.createElement("a");
      anchor.href = url;
      anchor.download = document.file_name;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast({
        title: "Could not download document",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const remove = async (document: ApiTransactionDocument) => {
    if (!window.confirm(`Remove ${document.file_name}? The stored file is also deleted when storage is available.`)) return;
    try {
      await apiFetch(document.download_url, { method: "DELETE" });
      query.refresh();
      window.dispatchEvent(new Event(TRANSACTION_CHANGED_EVENT));
      toast({ title: "Supporting document removed" });
    } catch (error) {
      toast({
        title: "Could not remove document",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium"><Paperclip className="size-4" /> Supporting documents</p>
          <p className="mt-1 text-xs text-muted-foreground">Receipts, acknowledgement letters, or payment evidence. Up to 10 PDF or image files.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading || query.loading || query.data?.storage_configured === false || (query.data?.documents.length ?? 0) >= 10}>
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
          {uploading ? "Uploading..." : "Add document"}
        </Button>
        <input ref={inputRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
      </div>

      {query.loading ? (
        <p className="text-xs text-muted-foreground">Loading documents...</p>
      ) : query.error ? (
        <p className="text-xs text-destructive">{query.error}</p>
      ) : (
        <>
          {query.data?.storage_configured === false && (
            <p className="text-xs text-muted-foreground">File storage is not configured on this Sika instance. Giving remains fully usable without it.</p>
          )}
          {query.data?.documents.length === 0 ? (
            <p className="text-xs text-muted-foreground">No supporting documents attached.</p>
          ) : (
            <div className="space-y-2">
              {query.data?.documents.map((document) => (
                <div key={document.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 px-3 py-2">
                  <FileText className="size-4 shrink-0 text-giving" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.file_name}</p>
                    {formatSize(document.size_bytes) && <p className="text-xs text-muted-foreground">{formatSize(document.size_bytes)}</p>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Download ${document.file_name}`} onClick={() => void download(document)} disabled={query.data?.storage_configured === false || downloadingId === document.id} title={query.data?.storage_configured === false ? "File storage is not configured" : undefined}>
                    {downloadingId === document.id ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-destructive hover:text-destructive" aria-label={`Remove ${document.file_name}`} onClick={() => void remove(document)}>
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
