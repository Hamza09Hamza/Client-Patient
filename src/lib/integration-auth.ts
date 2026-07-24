import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Guards integration endpoints: requires `Authorization: Bearer <key>`,
 * checked against `INTEGRATION_API_KEY`. Returns an error response to send,
 * or null when the request is allowed. See docs/API.md for the full contract.
 */
export function checkIntegrationAuth(request: NextRequest): NextResponse | null {
  const expected = process.env.INTEGRATION_API_KEY;
  if (!expected || expected.length < 16) {
    return NextResponse.json(
      { error: "Integration API is not configured on the server." },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`integration:${ip}`, 60, 60);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return NextResponse.json(
      { error: 'Missing or malformed Authorization header. Expected: "Bearer <api-key>".' },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="integration"' } },
    );
  }

  const a = Buffer.from(token);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }
  return null;
}
