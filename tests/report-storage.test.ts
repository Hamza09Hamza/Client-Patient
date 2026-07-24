import assert from "node:assert/strict";
import test from "node:test";
import {
  looksLikePdf,
  MAX_BATCH_BYTES,
  MAX_REPORT_BYTES,
  MAX_REPORTS_PER_BATCH,
} from "../src/lib/report-storage";

test("report upload limits match the SERVER A batch contract", () => {
  assert.equal(MAX_REPORTS_PER_BATCH, 10);
  assert.equal(MAX_REPORT_BYTES, 25 * 1024 * 1024);
  assert.equal(MAX_BATCH_BYTES, 100 * 1024 * 1024);
});

test("PDF header validation accepts a PDF header and rejects unrelated bytes", () => {
  assert.equal(looksLikePdf(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(looksLikePdf(Buffer.from("not a pdf")), false);
  assert.equal(looksLikePdf(Buffer.from("%PDF-")), false);
});
