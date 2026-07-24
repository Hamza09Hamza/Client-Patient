import assert from "node:assert/strict";
import test from "node:test";
import {
  generatePassword,
  generateUsername,
  hashPassword,
  verifyPasswordHash,
} from "../src/lib/password";

test("generated credentials use the documented unambiguous eight-character alphabet", () => {
  const allowed = /^[A-HJ-NP-Za-hj-km-np-z2-9]{8}$/;

  for (let index = 0; index < 200; index++) {
    assert.match(generateUsername(), allowed);
    assert.match(generatePassword(), allowed);
  }
});

test("passwords are stored as salted scrypt hashes and verify correctly", async () => {
  const password = generatePassword();
  const stored = await hashPassword(password);

  assert.notEqual(stored, password);
  assert.match(stored, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  assert.equal(await verifyPasswordHash(password, stored), true);
  assert.equal(await verifyPasswordHash(`${password}x`, stored), false);
  assert.equal(await verifyPasswordHash(password, "malformed"), false);
  assert.equal(await verifyPasswordHash(password, "00:not-hex"), false);
});
