import { NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import {
  createWorkspaceArchive,
  WorkspaceArchiveError,
} from "@/lib/workspace-archive";

function filenamePart(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 60) || "workspace";
}

export function workspaceArchiveResponse(
  archive: Awaited<ReturnType<typeof createWorkspaceArchive>>,
) {
  const date = archive.generatedAt.slice(0, 10);
  const filename = `sika-${filenamePart(archive.workspaceName)}-${date}.zip`;
  return new Response(Buffer.from(archive.bytes), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function GET() {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("owner");
    return workspaceArchiveResponse(await createWorkspaceArchive(workspaceId));
  } catch (error) {
    if (error instanceof WorkspaceArchiveError) {
      const status = error.code === "storage_unavailable" ? 503 : 502;
      return NextResponse.json(
        {
          error: error.message,
          ...(error.documentId ? { document_id: error.documentId } : {}),
        },
        { status },
      );
    }
    return errorResponse(error, "Failed to export workspace archive");
  }
}
