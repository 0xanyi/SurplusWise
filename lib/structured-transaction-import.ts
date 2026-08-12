import { XMLParser } from "fast-xml-parser";
import { transactionCreateSchema } from "@/lib/db/validation";
import type {
  TransactionImportAnalysis,
  TransactionImportPreviewRow,
  TransactionImportValidatedRow,
} from "@/lib/transaction-import";

export type StructuredTransactionImportFormat = "ofx" | "qif" | "camt053";

interface Candidate {
  lineNumber: number;
  amount: number;
  date: string;
  type: "expense" | "income";
  payee: string | null;
  notes: string | null;
  externalId: string | null;
  source: Record<string, string>;
}

function validateCandidates(candidates: Candidate[]): TransactionImportAnalysis {
  const previewRows: TransactionImportPreviewRow[] = candidates.map((candidate) => {
    const parsed = transactionCreateSchema.safeParse({
      amount: candidate.amount,
      date: candidate.date,
      type: candidate.type,
      category: "Uncategorized",
      payee: candidate.payee,
      notes: candidate.notes,
      tags: [],
      receiptStorageId: null,
    });
    const normalized: Omit<TransactionImportValidatedRow, "lineNumber"> | null = parsed.success
      ? {
          ...parsed.data,
          payee: parsed.data.payee ?? null,
          notes: parsed.data.notes ?? null,
          externalId: candidate.externalId,
          receiptStorageId: null,
        }
      : null;
    return {
      lineNumber: candidate.lineNumber,
      source: candidate.source,
      mapped: {},
      normalized,
      valid: parsed.success,
      errors: parsed.success ? [] : parsed.error.issues.map((issue) => issue.message),
    };
  });
  const validRows = previewRows.flatMap((row) =>
    row.normalized ? [{ lineNumber: row.lineNumber, ...row.normalized }] : [],
  );
  return {
    headers: [],
    mappings: {},
    requiredFields: [],
    previewRows,
    validRows,
    totalRows: candidates.length,
    validRowCount: validRows.length,
    invalidRowCount: previewRows.length - validRows.length,
    missingRequiredMappings: [],
  };
}

function dateOnly(value: string) {
  const digits = value.trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (digits) return `${digits[1]}-${digits[2]}-${digits[3]}`;
  const iso = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return iso?.[1] ?? value.trim();
}

function decodeEntities(value: string) {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (entity, code: string) => {
    if (code.startsWith("#x")) return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
    if (code.startsWith("#")) return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
    return named[code.toLowerCase()] ?? entity;
  });
}

function tagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<\\r\\n]*)`, "i"));
  return decodeEntities(match?.[1]?.trim() ?? "");
}

export function analyzeOfxImport(text: string) {
  const blocks = [...text.matchAll(/<STMTTRN(?:\s[^>]*)?>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN|<\/BANKTRANLIST))/gi)];
  if (blocks.length === 0) throw new Error("No transactions found in OFX/QFX file");
  return validateCandidates(
    blocks.map((match, index) => {
      const block = match[1];
      const signedAmount = Number.parseFloat(tagValue(block, "TRNAMT").replace(/,/g, ""));
      const payee = tagValue(block, "NAME") || tagValue(block, "PAYEE");
      const notes = tagValue(block, "MEMO");
      return {
        lineNumber: index + 1,
        amount: Math.abs(signedAmount),
        date: dateOnly(tagValue(block, "DTPOSTED")),
        type: signedAmount < 0 ? "expense" as const : "income" as const,
        payee: payee || null,
        notes: notes || null,
        externalId: tagValue(block, "FITID") || null,
        source: { format: "OFX/QFX", payee, notes },
      };
    }),
  );
}

function qifDate(value: string) {
  const normalized = value.trim().replace(/\s+/g, "").replace(/'/g, "/");
  const iso = normalized.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const local = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (!local) return normalized;
  const year = local[3].length === 2 ? `20${local[3]}` : local[3];
  return `${year}-${local[1].padStart(2, "0")}-${local[2].padStart(2, "0")}`;
}

export function analyzeQifImport(text: string) {
  const records = text
    .split(/^\^\s*$/m)
    .map((record) =>
      record
        .split(/\r?\n/)
        .filter((line) => !line.startsWith("!"))
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
  if (records.length === 0) throw new Error("No transactions found in QIF file");
  const field = (record: string, prefix: string) =>
    record.split(/\r?\n/).find((line) => line.startsWith(prefix))?.slice(prefix.length).trim() ?? "";
  return validateCandidates(
    records.map((record, index) => {
      const signedAmount = Number.parseFloat(field(record, "T").replace(/[^0-9.+-]/g, ""));
      const payee = field(record, "P");
      const notes = field(record, "M");
      return {
        lineNumber: index + 1,
        amount: Math.abs(signedAmount),
        date: qifDate(field(record, "D")),
        type: signedAmount < 0 ? "expense" as const : "income" as const,
        payee: payee || null,
        notes: notes || null,
        externalId: field(record, "N") || null,
        source: { format: "QIF", payee, notes },
      };
    }),
  );
}

function array(value: unknown): Record<string, unknown>[] {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(
    (item): item is Record<string, unknown> => typeof item === "object" && item !== null,
  );
}

function object(value: unknown) {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
}

function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(" · ");
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value === undefined || value === null) return "";
  const row = object(value);
  return text(row["#text"]);
}

function nested(row: Record<string, unknown>, ...path: string[]) {
  let value: unknown = row;
  for (const key of path) value = object(value)[key];
  return value;
}

export function analyzeCamt053Import(xml: string) {
  const parsed = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true }).parse(xml);
  const statements = array(nested(object(parsed), "Document", "BkToCstmrStmt", "Stmt"));
  const entries = statements.flatMap((statement) => array(statement.Ntry));
  if (entries.length === 0) throw new Error("No transactions found in CAMT.053 file");
  return validateCandidates(
    entries.map((entry, index) => {
      const signedAmount = Number.parseFloat(text(entry.Amt).replace(/,/g, ""));
      const direction = text(entry.CdtDbtInd);
      const details = object(array(nested(entry, "NtryDtls", "TxDtls"))[0]);
      const payee = direction === "DBIT"
        ? text(nested(details, "RltdPties", "Cdtr", "Nm"))
        : text(nested(details, "RltdPties", "Dbtr", "Nm"));
      const notes = text(entry.AddtlNtryInf) || text(nested(details, "RmtInf", "Ustrd"));
      const externalId =
        text(entry.AcctSvcrRef) ||
        text(entry.NtryRef) ||
        text(nested(details, "Refs", "AcctSvcrRef")) ||
        text(nested(details, "Refs", "EndToEndId")) ||
        text(nested(details, "Refs", "TxId"));
      const date = text(nested(entry, "BookgDt", "Dt")) || text(nested(entry, "BookgDt", "DtTm"));
      return {
        lineNumber: index + 1,
        amount: Math.abs(signedAmount),
        date: dateOnly(date),
        type: direction === "DBIT" ? "expense" as const : "income" as const,
        payee: payee || null,
        notes: notes || null,
        externalId: externalId || null,
        source: { format: "CAMT.053", payee, notes },
      };
    }),
  );
}

export function analyzeStructuredTransactionImport(
  textContent: string,
  format: StructuredTransactionImportFormat,
) {
  if (format === "ofx") return analyzeOfxImport(textContent);
  if (format === "qif") return analyzeQifImport(textContent);
  return analyzeCamt053Import(textContent);
}
