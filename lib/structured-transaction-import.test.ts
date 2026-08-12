import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyzeCamt053Import,
  analyzeOfxImport,
  analyzeQifImport,
} from "./structured-transaction-import";
import { detectTransactionImportFormat } from "./transaction-import";

describe("structured transaction imports", () => {
  it("reads XML and SGML-style OFX/QFX transactions", () => {
    const result = analyzeOfxImport(`OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260801120000.000[-5:EST]<TRNAMT>-12.50<FITID>bank-1<NAME>Corner &amp; Cafe<MEMO>Lunch</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260802<TRNAMT>1200.00<FITID>bank-2<NAME>Employer</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`);

    assert.equal(result.validRowCount, 2);
    assert.deepEqual(
      result.validRows.map(({ date, amount, type, payee, notes, externalId }) => ({
        date,
        amount,
        type,
        payee,
        notes,
        externalId,
      })),
      [
        {
          date: "2026-08-01",
          amount: 12.5,
          type: "expense",
          payee: "Corner & Cafe",
          notes: "Lunch",
          externalId: "bank-1",
        },
        {
          date: "2026-08-02",
          amount: 1200,
          type: "income",
          payee: "Employer",
          notes: null,
          externalId: "bank-2",
        },
      ],
    );
  });

  it("reads QIF records and reports invalid rows", () => {
    const result = analyzeQifImport(`!Type:Bank
D8/3/2026
T-24.99
PSupermarket
MGroceries
Nqif-1
^
Dnot-a-date
T10.00
PBroken
^`);

    assert.equal(result.totalRows, 2);
    assert.equal(result.validRowCount, 1);
    assert.equal(result.invalidRowCount, 1);
    assert.deepEqual(result.validRows[0], {
      lineNumber: 1,
      amount: 24.99,
      date: "2026-08-03",
      type: "expense",
      status: "cleared",
      category: "Uncategorized",
      payee: "Supermarket",
      notes: "Groceries",
      tags: [],
      externalId: "qif-1",
      receiptStorageId: null,
    });
  });

  it("reads namespaced CAMT.053 debit and credit entries", () => {
    const result = analyzeCamt053Import(`<?xml version="1.0"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08">
  <BkToCstmrStmt><Stmt>
    <Ntry><Amt Ccy="GBP">9.75</Amt><CdtDbtInd>DBIT</CdtDbtInd><BookgDt><Dt>2026-08-04</Dt></BookgDt><AcctSvcrRef>camt-1</AcctSvcrRef><NtryDtls><TxDtls><RltdPties><Cdtr><Nm>Bakery</Nm></Cdtr></RltdPties><RmtInf><Ustrd>Breakfast</Ustrd></RmtInf></TxDtls></NtryDtls></Ntry>
    <Ntry><Amt Ccy="GBP">500</Amt><CdtDbtInd>CRDT</CdtDbtInd><BookgDt><DtTm>2026-08-05T09:30:00Z</DtTm></BookgDt><NtryRef>camt-2</NtryRef><NtryDtls><TxDtls><RltdPties><Dbtr><Nm>Client Ltd</Nm></Dbtr></RltdPties></TxDtls></NtryDtls></Ntry>
  </Stmt></BkToCstmrStmt>
</Document>`);

    assert.equal(result.validRowCount, 2);
    assert.deepEqual(
      result.validRows.map(({ date, amount, type, payee, externalId }) => ({
        date,
        amount,
        type,
        payee,
        externalId,
      })),
      [
        { date: "2026-08-04", amount: 9.75, type: "expense", payee: "Bakery", externalId: "camt-1" },
        { date: "2026-08-05", amount: 500, type: "income", payee: "Client Ltd", externalId: "camt-2" },
      ],
    );
  });

  it("detects supported formats without trusting MIME types", () => {
    assert.equal(detectTransactionImportFormat("statement.QFX", ""), "ofx");
    assert.equal(detectTransactionImportFormat("statement.qif", ""), "qif");
    assert.equal(detectTransactionImportFormat("statement.xml", "<Document />"), "camt053");
    assert.equal(detectTransactionImportFormat("statement.csv", "date,amount"), "csv");
  });
});
