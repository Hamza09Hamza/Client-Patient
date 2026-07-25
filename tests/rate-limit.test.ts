import assert from "node:assert/strict";
import test from "node:test";
import { rateLimit } from "../src/lib/rate-limit";

test("rate limiting blocks requests beyond the window and resets after expiry", () => {
  const originalNow = Date.now;
  let now = 1_000;
  Date.now = () => now;

  try {
    const key = "test:fixed-window";

    assert.deepEqual(rateLimit(key, 2, 10), { allowed: true, retryAfter: 0 });
    assert.deepEqual(rateLimit(key, 2, 10), { allowed: true, retryAfter: 0 });
    assert.deepEqual(rateLimit(key, 2, 10), { allowed: false, retryAfter: 10 });

    now += 9_001;
    assert.deepEqual(rateLimit(key, 2, 10), { allowed: false, retryAfter: 1 });

    now += 999;
    assert.deepEqual(rateLimit(key, 2, 10), { allowed: true, retryAfter: 0 });
  } finally {
    Date.now = originalNow;
  }
});
