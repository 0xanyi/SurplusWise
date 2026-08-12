import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeTransactionImport, inferMappings, parseCsvLine } from "./transaction-import";

describe("parseCsvLine", () => {
  it("handles quoted commas", () => {
    assert.deepStrictEqual(
      parseCsvLine('2026-03-01,45.50,expense,"Food, Dining",Lunch'),
      ["2026-03-01", "45.50", "expense", "Food, Dining", "Lunch"],
    );
  });
});

describe("inferMappings", () => {
  it("matches common header aliases", () => {
    assert.deepStrictEqual(
      inferMappings(["Posted Date", "Transaction Amount", "Entry Type", "Group", "Memo"]),
      {
        date: "Posted Date",
        amount: "Transaction Amount",
        type: "Entry Type",
        category: "Group",
        notes: "Memo",
      },
    );
  });
});

describe("analyzeTransactionImport", () => {
  it("returns valid rows and invalid row errors", () => {
    const result = analyzeTransactionImport(`date,amount,type,category,notes,tags
2026-03-01,45.5,expense,Food,Lunch,meal;weekday
not-a-date,-3,expense,Food,Bad row,
2026-03-03,100,giving,Tithe,Sunday,church`);

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.validRowCount, 2);
    assert.strictEqual(result.invalidRowCount, 1);
    assert.deepStrictEqual(result.validRows[0]?.tags, ["meal", "weekday"]);
    assert.match(result.previewRows[1]?.errors[0] ?? "", /date/);
  });

  it("honors mapping overrides", () => {
    const result = analyzeTransactionImport(`posted,value,entry,bucket
2026-03-01,45.5,expense,Food`, {
      date: "posted",
      amount: "value",
      type: "entry",
      category: "bucket",
    });

    assert.strictEqual(result.validRowCount, 1);
    assert.deepStrictEqual(result.missingRequiredMappings, []);
  });

  it("allows an inferred column to be explicitly unmapped", () => {
    const result = analyzeTransactionImport(`date,amount,debit,description
2026-03-01,-45.5,45.5,Lunch`, {
      amount: null,
    });

    assert.strictEqual(result.validRowCount, 1);
    assert.strictEqual(result.validRows[0]?.amount, 45.5);
    assert.strictEqual(result.validRows[0]?.type, "expense");
  });

  it("infers expense and income from signed amounts without type or category", () => {
    const result = analyzeTransactionImport(`posted date,amount,merchant,description,transaction id
2026-03-01,-45.50,Cafe,Lunch,bank-1
2026-03-02,"£1,200.00",Employer,Salary,bank-2`);

    assert.strictEqual(result.validRowCount, 2);
    assert.deepStrictEqual(
      result.validRows.map(({ amount, type, category, payee, externalId }) => ({
        amount,
        type,
        category,
        payee,
        externalId,
      })),
      [
        { amount: 45.5, type: "expense", category: "Uncategorized", payee: "Cafe", externalId: "bank-1" },
        { amount: 1200, type: "income", category: "Uncategorized", payee: "Employer", externalId: "bank-2" },
      ],
    );
  });

  it("supports separate debit and credit columns", () => {
    const result = analyzeTransactionImport(`date,debit,credit,description
2026-03-01,12.50,,Lunch
2026-03-02,,500.00,Pay
2026-03-03,10.00,10.00,Broken`);

    assert.strictEqual(result.validRowCount, 2);
    assert.deepStrictEqual(
      result.validRows.map(({ amount, type }) => ({ amount, type })),
      [
        { amount: 12.5, type: "expense" },
        { amount: 500, type: "income" },
      ],
    );
    assert.match(result.previewRows[2]?.errors[0] ?? "", /both debit and credit/);
  });
});
