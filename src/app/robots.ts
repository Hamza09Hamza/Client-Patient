import type { MetadataRoute } from "next";

// This app is almost entirely behind a login — the only page worth a search
// engine finding is the sign-in screen. Everything else (patient portal, and
// especially the QR single-report share links under /r/, which point at
// individual patients' medical documents) must never be indexed. Reinforced
// per-route by the `robots` field in each page's metadata and the
// X-Robots-Tag header in next.config.ts — this file alone is advisory and
// not every crawler honors it.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/login"],
      disallow: ["/portal", "/r/", "/api/"],
    },
  };
}
