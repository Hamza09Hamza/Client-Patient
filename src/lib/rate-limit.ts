// Fixed-window in-memory rate limiter. Good enough for a single-instance
// deployment; swap for a Redis-backed limiter when scaling horizontally.

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

export interface RateLimitResult {
  allowed: boolean;
  /** seconds until the window resets — for Retry-After / user messaging */
  retryAfter: number;
}

export function rateLimit(key: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const win = windows.get(key);

  if (!win || win.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfter: 0 };
  }

  win.count += 1;
  if (win.count > max) {
    return { allowed: false, retryAfter: Math.ceil((win.resetAt - now) / 1000) };
  }
  return { allowed: true, retryAfter: 0 };
}

// Opportunistic cleanup so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, win] of windows) {
    if (win.resetAt <= now) windows.delete(key);
  }
}, 60_000).unref?.();
