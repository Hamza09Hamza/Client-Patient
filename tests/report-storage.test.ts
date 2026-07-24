import assert from "node:assert/strict";
import test from "node:test";
import {
  deleteReportPdf,
  looksLikePdf,
  MAX_BATCH_BYTES,
  MAX_MULTIPART_BYTES,
  MAX_REPORT_BYTES,
  MAX_REPORTS_PER_BATCH,
  readReportPdf,
  reportSha256,
} from "../src/lib/report-storage";

test("report upload limits match the SERVER A batch contract", () => {
  assert.equal(MAX_REPORTS_PER_BATCH, 10);
  assert.equal(MAX_REPORT_BYTES, 25 * 1024 * 1024);
  assert.equal(MAX_BATCH_BYTES, 100 * 1024 * 1024);
  assert.equal(MAX_MULTIPART_BYTES, 105 * 1024 * 1024);
});

test("PDF header validation accepts a PDF header and rejects unrelated bytes", () => {
  assert.equal(looksLikePdf(Buffer.from("%PDF-1.7\n")), true);
  assert.equal(looksLikePdf(Buffer.from("not a pdf")), false);
  assert.equal(looksLikePdf(Buffer.from("%PDF-")), false);
});

test("report fingerprints are stable and distinguish different PDF bytes", () => {
  const first = Buffer.from("%PDF-1.7\nfirst");
  const identical = Buffer.from("%PDF-1.7\nfirst");
  const different = Buffer.from("%PDF-1.7\nsecond");

  assert.equal(reportSha256(first), reportSha256(identical));
  assert.notEqual(reportSha256(first), reportSha256(different));
  assert.match(reportSha256(first), /^[0-9a-f]{64}$/);
});

test("stored report filenames cannot escape the private reports directory", async () => {
  await assert.rejects(readReportPdf("../secret.pdf"), /Invalid stored report filename/);
  await assert.rejects(deleteReportPdf("/tmp/report.pdf"), /Invalid stored report filename/);
});
