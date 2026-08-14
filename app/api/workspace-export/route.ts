import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import { createWorkspaceExport } from "@/lib/db/workspace-export";

function filenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "workspace";
}

export function workspaceExportResponse(payload: Awaited<ReturnType<typeof createWorkspaceExport>>) {
  const date = payload.generatedAt.slice(0, 10);
  const filename = `sika-${filenamePart(payload.workspace.name)}-${date}.json`;

  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuthWithWorkspace();
    return workspaceExportResponse(await createWorkspaceExport(userId, workspaceId));
  } catch (error) {
    return errorResponse(error, "Failed to export workspace data");
  }
}
