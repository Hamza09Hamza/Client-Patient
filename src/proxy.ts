import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";
import { db } from "@/lib/db";

// The QR single-report viewer (/r/*) is public and gets a strict, nonced CSP —
// dynamic because a fresh nonce is required on every request, see
// docs/API.md "QR single-report sharing" and Next's CSP guide.
//
// style-src intentionally has no nonce: once a nonce (or hash) is present in a
// CSP directive, browsers drop 'unsafe-inline' for that directive entirely
// (not as a fallback). PdfViewer sets canvas.style.width/height via JS for
// HiDPI-aware sizing on every render (src/components/portal/pdf-viewer.tsx) —
// that's core to how the viewer works, unconditionally, on every page that
// renders a PDF, so style-src needs 'unsafe-inline' rather than a nonce.
// script-src is where a nonce actually matters for XSS protection, so it
// keeps one.
function withShareCsp(response: NextResponse, nonce: string): NextResponse {
  const isDev = process.env.NODE_ENV === "development";
  const csp = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
    .replace(/\s{2,}/g, " ")
    .trim();
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

// Optimistic auth checks only — every page/action re-verifies via the DAL.
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/r/")) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-nonce", nonce);
    return withShareCsp(NextResponse.next({ request: { headers: requestHeaders } }), nonce);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const clearSessionCookie = (response: NextResponse) => {
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  };
  const redirect = (to: string, clearSession = false) => {
    const response = NextResponse.redirect(new URL(to, request.url));
    return clearSession ? clearSessionCookie(response) : response;
  };
  const next = (clearSession = false) => {
    const response = NextResponse.next();
    return clearSession ? clearSessionCookie(response) : response;
  };

  // A valid signature only proves that we issued the JWT. The patient may
  // since have been disabled or deleted, so verify the row before treating
  // the session as active. On a transient database error, leave the final
  // decision to the page's authoritative DAL check rather than logging out a
  // legitimate patient.
  let patientActive: boolean | null = null;
  if (session?.role === "patient") {
    try {
      const patient = await db.patient.findUnique({
        where: { id: session.sub },
        select: { status: true },
      });
      patientActive = patient?.status === "ACTIVE";
    } catch {
      patientActive = null;
    }
  }

  if (session?.role === "patient" && patientActive === false) {
    return redirect("/login", true);
  }

  if (pathname === "/") {
    if (session?.role === "patient" && patientActive !== false) return redirect("/portal");
    return redirect("/login", Boolean(token));
  }

  if (pathname.startsWith("/portal")) {
    if (session?.role !== "patient") return redirect("/login", Boolean(token));
    return next();
  }

  if (pathname === "/login") {
    if (session?.role === "patient" && patientActive === true) return redirect("/portal");
    return next(Boolean(token && !session));
  }

  return next();
}

export const config = {
  matcher: ["/", "/login", "/portal/:path*", "/r/:path*"],
};
