import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  detectSupportingDocumentMime,
  safeDocumentFileName,
} from "./supporting-documents";

describe("supporting documents", () => {
  it("detects supported file signatures", () => {
    assert.equal(detectSupportingDocumentMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d])), "application/pdf");
    assert.equal(detectSupportingDocumentMime(Uint8Array.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
    assert.equal(
      detectSupportingDocumentMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
      "image/png",
    );
    assert.equal(
      detectSupportingDocumentMime(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])),
      "image/webp",
    );
  });

  it("rejects spoofed content and normalizes file names", () => {
    assert.equal(detectSupportingDocumentMime(Uint8Array.from([1, 2, 3, 4])), null);
    assert.equal(detectSupportingDocumentMime(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x00])), null);
    assert.equal(
      detectSupportingDocumentMime(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])),
      null,
    );
    assert.equal(safeDocumentFileName("  receipt\u0000.pdf  "), "receipt.pdf");
    assert.equal(safeDocumentFileName("   "), "Supporting document");
  });
});
