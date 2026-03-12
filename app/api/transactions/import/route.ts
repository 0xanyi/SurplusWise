import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as txService from "@/lib/db/transactions";
import { checkRateLimit } from "@/lib/rate-limit";

type TransactionType = "expense" | "giving" | "income";

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeType(value: string): TransactionType {
  const normalized = value.trim().toLowerCase();
  if (normalized === "income" || normalized === "expense" || normalized === "giving") {
    return normalized;
  }
  throw new Error(`Invalid type: ${value}`);
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

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No CSV file provided" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ error: "CSV must include a header row and at least one data row" }, { status: 400 });
    }

    const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
    const required = ["date", "amount", "type", "category"];
    const missing = required.filter((field) => !headers.includes(field));
    if (missing.length > 0) {
      return NextResponse.json({ error: `Missing required columns: ${missing.join(", ")}` }, { status: 400 });
    }

    const imported: string[] = [];

    for (const line of lines.slice(1)) {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));

      const amount = Number.parseFloat(row.amount);
      if (!row.date || Number.isNaN(amount) || amount <= 0 || !row.category) {
        continue;
      }

      const created = await txService.create(userId, workspaceId, {
        date: row.date,
        amount,
        type: normalizeType(row.type),
        category: row.category,
        notes: row.notes || null,
        receiptStorageId: null,
      });

      imported.push(created.id);
    }

    return NextResponse.json({ imported: imported.length });
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
