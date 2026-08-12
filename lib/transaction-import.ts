import { transactionCreateSchema } from "@/lib/db/validation";

export type TransactionImportField =
  | "date"
  | "amount"
  | "debit"
  | "credit"
  | "type"
  | "category"
  | "notes"
  | "tags"
  | "externalId";

export const UNMAPPED_IMPORT_COLUMN = "__unmapped__";

export type TransactionImportMapping = Partial<Record<TransactionImportField, string | null>>;

export interface TransactionImportPreviewRow {
  lineNumber: number;
  source: Record<string, string>;
  mapped: Partial<Record<TransactionImportField, string>>;
  normalized: Omit<TransactionImportValidatedRow, "lineNumber"> | null;
  valid: boolean;
  errors: string[];
}

export interface TransactionImportValidatedRow {
  lineNumber: number;
  amount: number;
  date: string;
  type: "expense" | "giving" | "income";
  category: string;
  notes: string | null;
  tags: string[];
  externalId: string | null;
  receiptStorageId: null;
}

export interface TransactionImportAnalysis {
  headers: string[];
  mappings: TransactionImportMapping;
  requiredFields: TransactionImportField[];
  previewRows: TransactionImportPreviewRow[];
  validRows: TransactionImportValidatedRow[];
  totalRows: number;
  validRowCount: number;
  invalidRowCount: number;
  missingRequiredMappings: TransactionImportField[];
}

const REQUIRED_FIELDS: TransactionImportField[] = ["date", "amount"];

const HEADER_ALIASES: Record<TransactionImportField, string[]> = {
  date: ["date", "transaction date", "posted date", "payment date"],
  amount: ["amount", "value", "total", "transaction amount"],
  debit: ["debit", "withdrawal", "money out", "paid out"],
  credit: ["credit", "deposit", "money in", "paid in"],
  type: ["type", "transaction type", "entry type"],
  category: ["category", "group", "bucket"],
  notes: ["notes", "note", "description", "memo", "details"],
  tags: ["tags", "labels", "tag"],
  externalId: ["transaction id", "transaction reference", "bank id", "external id"],
};

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

export function parseCsvLine(line: string) {
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

function normalizeType(value: string): "expense" | "giving" | "income" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "expense" || normalized === "giving" || normalized === "income") {
    return normalized;
  }
  throw new Error(`Invalid type: ${value}`);
}

function parseTags(value: string) {
  return value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAmount(value: string) {
  const trimmed = value.trim();
  const parenthesized = /^\(.*\)$/.test(trimmed);
  const numeric = trimmed
    .replace(/^\((.*)\)$/, "$1")
    .replace(/[^0-9.,+-]/g, "")
    .replace(/,/g, "");
  const amount = Number.parseFloat(numeric);
  return parenthesized ? -amount : amount;
}

export function inferMappings(headers: string[]): TransactionImportMapping {
  const normalizedHeaders = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const mappings: TransactionImportMapping = {};

  for (const field of Object.keys(HEADER_ALIASES) as TransactionImportField[]) {
    const match = HEADER_ALIASES[field].find((alias) => normalizedHeaders.has(alias));
    if (match) {
      mappings[field] = normalizedHeaders.get(match);
    }
  }

  return mappings;
}

function parseCsv(text: string) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("CSV must include a header row and at least one data row");
  }

  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map((line, index) => ({
    lineNumber: index + 2,
    values: parseCsvLine(line),
  }));

  return { headers, rows };
}

function mapRow(
  headers: string[],
  values: string[],
  mappings: TransactionImportMapping,
) {
  const source = Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  const mapped: Partial<Record<TransactionImportField, string>> = {};

  for (const field of Object.keys(mappings) as TransactionImportField[]) {
    const header = mappings[field];
    if (!header) continue;
    mapped[field] = source[header] ?? "";
  }

  return { source, mapped };
}

function validateMappedRow(
  mapped: Partial<Record<TransactionImportField, string>>,
): { row?: Omit<TransactionImportValidatedRow, "lineNumber">; errors: string[] } {
  const errors: string[] = [];

  if (!mapped.date?.trim()) {
    errors.push("Missing date");
  }
  const hasAmount = Boolean(mapped.amount?.trim());
  const hasDebit = Boolean(mapped.debit?.trim());
  const hasCredit = Boolean(mapped.credit?.trim());
  if (!hasAmount && !hasDebit && !hasCredit) {
    errors.push("Missing amount, debit, or credit");
  }
  if (hasAmount && (hasDebit || hasCredit)) {
    errors.push("Use either amount or debit/credit columns, not both");
  }

  if (errors.length > 0) {
    return { errors };
  }

  let amount: number;
  let inferredType: "expense" | "income";
  if (hasAmount) {
    const signedAmount = parseAmount(mapped.amount ?? "");
    amount = Math.abs(signedAmount);
    inferredType = signedAmount < 0 ? "expense" : "income";
  } else {
    const debit = hasDebit ? Math.abs(parseAmount(mapped.debit ?? "")) : 0;
    const credit = hasCredit ? Math.abs(parseAmount(mapped.credit ?? "")) : 0;
    if (debit > 0 && credit > 0) {
      return { errors: ["A row cannot contain both debit and credit amounts"] };
    }
    amount = debit || credit;
    inferredType = debit > 0 ? "expense" : "income";
  }

  let type: "expense" | "giving" | "income" = inferredType;
  if (mapped.type?.trim()) {
    try {
      type = normalizeType(mapped.type);
    } catch (error) {
      return { errors: [error instanceof Error ? error.message : "Invalid type"] };
    }
  }

  const candidate = {
    amount,
    date: mapped.date?.trim() ?? "",
    type,
    category: mapped.category?.trim() || "Uncategorized",
    notes: mapped.notes?.trim() ? mapped.notes.trim() : null,
    tags: mapped.tags?.trim() ? parseTags(mapped.tags) : [],
    externalId: mapped.externalId?.trim() || null,
    receiptStorageId: null,
  };

  const parsed = transactionCreateSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      errors: parsed.error.issues.map((issue) => issue.message),
    };
  }

  return {
    row: {
      ...parsed.data,
      notes: parsed.data.notes ?? null,
      externalId: candidate.externalId,
      receiptStorageId: null,
    },
    errors: [],
  };
}

export function analyzeTransactionImport(
  text: string,
  mappingOverrides?: TransactionImportMapping,
): TransactionImportAnalysis {
  const { headers, rows } = parseCsv(text);
  const mappings = { ...inferMappings(headers), ...mappingOverrides };
  const missingRequiredMappings = [
    ...(!mappings.date ? (["date"] as TransactionImportField[]) : []),
    ...(!mappings.amount && !mappings.debit && !mappings.credit
      ? (["amount"] as TransactionImportField[])
      : []),
  ];

  const previewRows: TransactionImportPreviewRow[] = [];
  const validRows: TransactionImportValidatedRow[] = [];

  for (const row of rows) {
    const mappedRow = mapRow(headers, row.values, mappings);
    const { row: validRow, errors } = validateMappedRow(mappedRow.mapped);
    const previewRow: TransactionImportPreviewRow = {
      lineNumber: row.lineNumber,
      source: mappedRow.source,
      mapped: mappedRow.mapped,
      normalized: validRow ?? null,
      valid: errors.length === 0,
      errors,
    };

    previewRows.push(previewRow);
    if (validRow) {
      validRows.push({
        lineNumber: row.lineNumber,
        ...validRow,
      });
    }
  }

  return {
    headers,
    mappings,
    requiredFields: REQUIRED_FIELDS,
    previewRows,
    validRows,
    totalRows: rows.length,
    validRowCount: validRows.length,
    invalidRowCount: previewRows.length - validRows.length,
    missingRequiredMappings,
  };
}
