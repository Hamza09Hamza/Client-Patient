import assert from "node:assert/strict";
import test from "node:test";
import { SignJWT } from "jose";
import { verifySessionToken } from "../src/lib/session";

const TEST_SECRET = "test-auth-secret-with-more-than-thirty-two-characters";
const key = new TextEncoder().encode(TEST_SECRET);

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

test("patient session tokens return the expected scoped payload", async () => {
  process.env.AUTH_SECRET = TEST_SECRET;
  const token = await sign({
    sub: "patient-db-id",
    username: "patient01",
    name: "Jane Doe",
    role: "patient",
  });

  assert.deepEqual(await verifySessionToken(token), {
    sub: "patient-db-id",
    username: "patient01",
    name: "Jane Doe",
    role: "patient",
  });
});

test("session verification rejects unexpected roles and incomplete payloads", async () => {
  process.env.AUTH_SECRET = TEST_SECRET;

  const staffToken = await sign({
    sub: "staff-db-id",
    username: "staff01",
    name: "Staff User",
    role: "staff",
  });
  const incompleteToken = await sign({
    sub: "patient-db-id",
    username: "patient01",
    role: "patient",
  });

  assert.equal(await verifySessionToken(staffToken), null);
  assert.equal(await verifySessionToken(incompleteToken), null);
});

test("session verification rejects tokens signed with another secret or modified in transit", async () => {
  process.env.AUTH_SECRET = TEST_SECRET;

  const otherKey = new TextEncoder().encode(
    "different-test-secret-with-more-than-thirty-two-characters",
  );
  const wrongSecretToken = await new SignJWT({
    sub: "patient-db-id",
    username: "patient01",
    name: "Jane Doe",
    role: "patient",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(otherKey);

  const validToken = await sign({
    sub: "patient-db-id",
    username: "patient01",
    name: "Jane Doe",
    role: "patient",
  });
  const tamperedToken = `${validToken.slice(0, -1)}${validToken.endsWith("a") ? "b" : "a"}`;

  assert.equal(await verifySessionToken(wrongSecretToken), null);
  assert.equal(await verifySessionToken(tamperedToken), null);
  assert.equal(await verifySessionToken("not-a-jwt"), null);
});
