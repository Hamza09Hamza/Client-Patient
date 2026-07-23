import { NextResponse, type NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

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

  const redirect = (to: string) => NextResponse.redirect(new URL(to, request.url));

  if (pathname === "/") {
    if (session?.role === "patient") return redirect("/portal");
    return redirect("/login");
  }

  if (pathname.startsWith("/portal")) {
    if (session?.role !== "patient") return redirect("/login");
    return NextResponse.next();
  }

  if (pathname === "/login" && session?.role === "patient") return redirect("/portal");

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/portal/:path*", "/r/:path*"],
};
