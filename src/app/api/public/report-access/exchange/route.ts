import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { redeemShareGrant, signShareSession, SHARE_COOKIE, SHARE_SESSION_SECONDS } from "@/lib/report-share";

/**
 * Public, unauthenticated: exchanges the QR URL fragment's token for an
 * HttpOnly, path-scoped session cookie — see /r/[publicId]/page.tsx and
 * docs/API.md "QR single-report sharing". The fragment never reaches this
 * server on its own (browsers don't send URL fragments), so the client script
 * on the /r/[publicId] page reads it and POSTs it here.
 */

const bodySchema = z.object({
  publicId: z.string().trim().min(1).max(40),
  token: z.string().trim().min(1).max(500),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`share-exchange:${ip}`, 20, 60);
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfter) } },
    );
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const redeemed = await redeemShareGrant(parsed.data.publicId, parsed.data.token);
  if (!redeemed) {
    return NextResponse.json(
      { error: "This link is invalid, expired, or has been revoked." },
      { status: 401 },
    );
  }

  await audit("SYSTEM", "qr-share", "REPORT_SHARE_VIEWED", parsed.data.publicId);

  const session = await signShareSession(parsed.data.publicId, redeemed.labResultId);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SHARE_COOKIE, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: `/r/${parsed.data.publicId}`,
    maxAge: SHARE_SESSION_SECONDS,
  });
  return response;
}
