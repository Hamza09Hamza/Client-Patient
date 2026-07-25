import assert from "node:assert/strict";
import test from "node:test";
import { signShareSession, verifyShareSession } from "../src/lib/report-share";

const TEST_SECRET = "test-auth-secret-with-more-than-thirty-two-characters";

function tamperSignature(token: string): string {
  const [header, payload, signature] = token.split(".");
  const first = signature[0] === "a" ? "b" : "a";
  return `${header}.${payload}.${first}${signature.slice(1)}`;
}

test("report share sessions are valid only for the public report id they were issued for", async () => {
  process.env.AUTH_SECRET = TEST_SECRET;

  const token = await signShareSession("RPT-ABC123", "result-db-id");

  assert.equal(await verifyShareSession(token, "RPT-ABC123"), "result-db-id");
  assert.equal(await verifyShareSession(token, "RPT-OTHER"), null);
});

test("report share verification rejects malformed or modified tokens", async () => {
  process.env.AUTH_SECRET = TEST_SECRET;

  const token = await signShareSession("RPT-ABC123", "result-db-id");

  assert.equal(await verifyShareSession(tamperSignature(token), "RPT-ABC123"), null);
  assert.equal(await verifyShareSession("not-a-jwt", "RPT-ABC123"), null);
});
