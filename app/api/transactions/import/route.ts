import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as txService from "@/lib/db/transactions";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  analyzeTransactionImport,
  type TransactionImportField,
  type TransactionImportMapping,
  UNMAPPED_IMPORT_COLUMN,
} from "@/lib/transaction-import";

function getMappingValue(formData: FormData, field: TransactionImportField) {
  const value = formData.get(`mapping:${field}`);
  if (value === UNMAPPED_IMPORT_COLUMN) return null;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function POST(request: NextRequest) {
  try {
    const rateKey = `${request.headers.get("x-forwarded-for") ?? "local"}:transactions:import`;
    const rateLimit = checkRateLimit(rateKey, { limit: 10, windowMs: 60_000 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: "Too many import attempts. Please try again shortly." },
        { status: 429 },
      );
    }

    const { userId, workspaceId } = await requireAuthWithWorkspace();
    const formData = await request.formData();
    const file = formData.get("file");
    const accountIdValue = formData.get("accountId");
    const accountId =
      typeof accountIdValue === "string" && accountIdValue.trim()
        ? accountIdValue.trim()
        : null;
    const action = formData.get("action") === "preview" ? "preview" : "commit";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }

    const text = await file.text();
    const mapping: TransactionImportMapping = {
      date: getMappingValue(formData, "date"),
      amount: getMappingValue(formData, "amount"),
      debit: getMappingValue(formData, "debit"),
      credit: getMappingValue(formData, "credit"),
      type: getMappingValue(formData, "type"),
      category: getMappingValue(formData, "category"),
      notes: getMappingValue(formData, "notes"),
      tags: getMappingValue(formData, "tags"),
      externalId: getMappingValue(formData, "externalId"),
    };

    const analysis = analyzeTransactionImport(text, mapping);

    if (analysis.missingRequiredMappings.length > 0) {
      return NextResponse.json(
        { error: `Missing required column mappings: ${analysis.missingRequiredMappings.join(", ")}` },
        { status: 400 },
      );
    }

    if (analysis.validRows.length === 0) {
      return NextResponse.json(
        {
          error: "No valid rows found to import",
          invalid_rows: analysis.previewRows.filter((row) => !row.valid).slice(0, 10),
        },
        { status: 400 },
      );
    }

    if (action === "preview") {
      const review = await txService.reviewImport(
        userId,
        workspaceId,
        accountId,
        analysis.validRows,
      );
      return NextResponse.json({
        ready: review.ready,
        duplicates: review.duplicateLineNumbers.length,
        duplicate_rows: review.duplicateLineNumbers,
        invalid: analysis.invalidRowCount,
        total_rows: analysis.totalRows,
      });
    }

    const result = await txService.importRows(
      userId,
      workspaceId,
      accountId,
      analysis.validRows,
    );
    return NextResponse.json({
      imported: result.importedIds.length,
      duplicates: result.duplicateLineNumbers.length,
      duplicate_rows: result.duplicateLineNumbers,
      skipped: analysis.invalidRowCount,
      total_rows: analysis.totalRows,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import CSV" },
      { status: 500 },
    );
  }
}
