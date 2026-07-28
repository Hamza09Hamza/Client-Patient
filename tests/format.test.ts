import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatDateTime } from "../src/lib/format";

const sample = new Date(2026, 6, 28, 14, 30);

test("dates use the selected English or Algerian French locale", () => {
  assert.equal(formatDate(sample, "en"), "28 Jul 2026");
  assert.equal(formatDate(sample, "fr"), "28 juil. 2026");
});

test("date-times translate the month while preserving the local time", () => {
  assert.match(formatDateTime(sample, "en"), /^28 Jul 2026, 14:30$/);
  assert.match(formatDateTime(sample, "fr"), /^28 juil\. 2026, 14:30$/);
});
