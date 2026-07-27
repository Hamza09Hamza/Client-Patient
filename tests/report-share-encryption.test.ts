import assert from "node:assert/strict";
import test from "node:test";
import { decryptToken, encryptToken } from "../src/lib/report-share";

const TEST_KEY = "test-report-share-encryption-key-32-chars-plus";
const OTHER_KEY = "a-completely-different-encryption-key-32-chars";

test("QR tokens round-trip through encryption unchanged", () => {
  process.env.REPORT_SHARE_ENCRYPTION_KEY = TEST_KEY;

  const token = "opaque-share-token-value";
  const encrypted = encryptToken(token);

  assert.notEqual(encrypted, token);
  assert.equal(decryptToken(encrypted), token);
});

test("decryption fails closed on tampered ciphertext", () => {
  process.env.REPORT_SHARE_ENCRYPTION_KEY = TEST_KEY;

  const encrypted = encryptToken("opaque-share-token-value");
  const raw = Buffer.from(encrypted, "base64");
  raw[raw.length - 1] ^= 0xff; // flip a byte inside the ciphertext
  const tampered = raw.toString("base64");

  assert.equal(decryptToken(tampered), null);
});

test("decryption fails closed under the wrong key", () => {
  process.env.REPORT_SHARE_ENCRYPTION_KEY = TEST_KEY;
  const encrypted = encryptToken("opaque-share-token-value");

  process.env.REPORT_SHARE_ENCRYPTION_KEY = OTHER_KEY;
  assert.equal(decryptToken(encrypted), null);

  process.env.REPORT_SHARE_ENCRYPTION_KEY = TEST_KEY;
});

test("decryption rejects garbage input instead of throwing", () => {
  process.env.REPORT_SHARE_ENCRYPTION_KEY = TEST_KEY;
  assert.equal(decryptToken("not-valid-base64-ciphertext"), null);
});
