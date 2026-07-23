import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
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
    ];
  },
};

export default nextConfig;
