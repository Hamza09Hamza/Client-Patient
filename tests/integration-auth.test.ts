import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { checkIntegrationAuth } from "../src/lib/integration-auth";

const TEST_KEY = "integration-test-key-with-safe-length";

function request(authorization?: string, ip = "203.0.113.10"): NextRequest {
  const headers = new Headers({ "x-forwarded-for": ip });
  if (authorization) headers.set("authorization", authorization);
  return new NextRequest("http://localhost/api/integration/patients", { headers });
}

test("integration authentication fails closed when the server key is missing", async () => {
  const previous = process.env.INTEGRATION_API_KEY;
  delete process.env.INTEGRATION_API_KEY;

  try {
    const response = checkIntegrationAuth(request(`Bearer ${TEST_KEY}`));
    assert.ok(response);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: "Integration API is not configured on the server.",
    });
  } finally {
    if (previous === undefined) delete process.env.INTEGRATION_API_KEY;
    else process.env.INTEGRATION_API_KEY = previous;
  }
});

test("integration authentication enforces the Bearer scheme and exact API key", async () => {
  process.env.INTEGRATION_API_KEY = TEST_KEY;

  const missing = checkIntegrationAuth(request(undefined, "203.0.113.11"));
  const malformed = checkIntegrationAuth(request(TEST_KEY, "203.0.113.12"));
  const invalid = checkIntegrationAuth(request("Bearer wrong-key", "203.0.113.13"));
  const valid = checkIntegrationAuth(request(`Bearer ${TEST_KEY}`, "203.0.113.14"));

  assert.ok(missing);
  assert.equal(missing.status, 401);
  assert.equal(missing.headers.get("www-authenticate"), 'Bearer realm="integration"');

  assert.ok(malformed);
  assert.equal(malformed.status, 401);

  assert.ok(invalid);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: "Invalid API key." });

  assert.equal(valid, null);
});
