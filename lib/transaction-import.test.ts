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
2026-03-02,-3,expense,Food,Bad row,
2026-03-03,100,giving,Tithe,Sunday,church`);

    assert.strictEqual(result.totalRows, 3);
    assert.strictEqual(result.validRowCount, 2);
    assert.strictEqual(result.invalidRowCount, 1);
    assert.deepStrictEqual(result.validRows[0]?.tags, ["meal", "weekday"]);
    assert.match(result.previewRows[1]?.errors[0] ?? "", /positive/);
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
});
