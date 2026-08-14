"use client";

import { DatabaseBackup, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

interface BackupStatus {
  configured: boolean;
  last_successful_at: string | null;
}

export function BackupStatusSettings() {
  const { data: status, loading, error } = useApiQuery<BackupStatus>("/api/backup-status");
  const lastSuccess = status?.last_successful_at
    ? new Date(status.last_successful_at).toLocaleString()
    : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DatabaseBackup className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
            Backup monitoring
          </h2>
        </div>
        <CardDescription>
          Tracks successful backups reported by your server&apos;s validated backup job.
        </CardDescription>
      </CardHeader>
      <CardContent>
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
