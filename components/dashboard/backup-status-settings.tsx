"use client";

import { useState } from "react";
import { DatabaseBackup, Download, Loader2 } from "lucide-react";
import { apiFetchBlob, useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface BackupStatus {
  configured: boolean;
  last_successful_at: string | null;
}

export function BackupStatusSettings() {
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const { data: status, loading, error } = useApiQuery<BackupStatus>("/api/backup-status");
  const lastSuccess = status?.last_successful_at
    ? new Date(status.last_successful_at).toLocaleString()
    : null;

  const downloadExport = async () => {
    setExporting(true);
    try {
      const blob = await apiFetchBlob("/api/workspace-export");
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `sika-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (error) {
      toast({
        title: "Could not export workspace",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DatabaseBackup className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
            Data resilience
          </h2>
        </div>
        <CardDescription>
          Export your records and monitor your server&apos;s validated backup job.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex flex-col gap-3 border-t border-border/60 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">Export this workspace</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Download financial records, plans, and settings as JSON. Attached files are not included yet.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void downloadExport()} disabled={exporting}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            Export JSON
          </Button>
        </div>
        <div className="border-t border-border/60 py-3.5">
          {loading ? (
            <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
          ) : error ? (
            <p className="text-sm text-destructive">Backup status is unavailable.</p>
          ) : !status?.configured ? (
            <p className="text-sm text-muted-foreground">
              Monitoring is not configured. Set <code>BACKUP_REPORT_TOKEN</code> on the server.
            </p>
          ) : (
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {lastSuccess ? `Last successful backup: ${lastSuccess}` : "No successful backup reported"}
              </p>
              <p className="text-sm text-muted-foreground">
                Report success only after the backup archive has been validated.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
