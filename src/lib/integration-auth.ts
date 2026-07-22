import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Guards integration endpoints: requires the shared key in x-api-key.
 * Returns an error response to send, or null when the request is allowed.
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

  const provided = request.headers.get("x-api-key") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Invalid API key." }, { status: 401 });
  }
  return null;
}
