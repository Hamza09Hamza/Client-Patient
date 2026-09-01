import type { NextConfig } from "next";

const allowedDevOrigins = process.env.ALLOWED_DEV_ORIGINS
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

// Server Actions compare the browser's Origin header against Host/
// X-Forwarded-Host and abort on mismatch (CSRF protection) — see
// node_modules/next/dist/docs/.../serverActions.md "allowedOrigins". Behind
// a reverse proxy on a non-default port (our nginx setup, currently :8443)
// this needs to be explicit, or every Server Action (login, logout, etc.)
// gets silently rejected. Derived from PUBLIC_BASE_URL so it can't drift out
// of sync with the actual public origin.
let serverActionsAllowedOrigins: string[] | undefined;
if (process.env.PUBLIC_BASE_URL) {
  try {
    serverActionsAllowedOrigins = [new URL(process.env.PUBLIC_BASE_URL).host];
  } catch {
    // Malformed PUBLIC_BASE_URL is already validated where it's required
    // (src/app/api/integration/reports/route.ts); don't crash the build over it here.
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  ...(serverActionsAllowedOrigins?.length
    ? { experimental: { serverActions: { allowedOrigins: serverActionsAllowedOrigins } } }
    : {}),
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
            : []),
        ],
      },
      {
        // The QR single-report viewer is a public, unauthenticated-until-token-
        // exchange page — lock it down beyond the app's normal defaults, see
        // docs/API.md "QR single-report sharing". Content-Security-Policy is
        // set in src/proxy.ts instead (it needs a fresh per-request nonce).
        source: "/r/:path*",
        headers: [
          { key: "Cache-Control", value: "private, no-store" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        // Belt-and-suspenders alongside robots.txt and per-page `robots` metadata:
        // this header is what actually stops a PDF byte-stream route (no HTML, so
        // no meta tag applies) from ever being indexed or cached by a crawler.
        source: "/(portal|api)/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
      {
        // PdfViewer (src/components/portal/pdf-viewer.tsx) embeds this exact
        // route in a same-origin <iframe> so the browser's native PDF viewer
        // renders it. The blanket X-Frame-Options: DENY above blocks ALL
        // framing, same-origin included, which would leave that iframe
        // permanently blank. Override to SAMEORIGIN for just these two
        // byte-serving routes — last-matching header wins on overlapping
        // sources, see Next's headers() docs.
        source: "/r/:publicId/file",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
      {
        source: "/portal/results/:id/file",
        headers: [{ key: "X-Frame-Options", value: "SAMEORIGIN" }],
      },
    ];
  },
};

export default nextConfig;
