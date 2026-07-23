"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface ShareExchangeProps {
  publicId: string;
  dict: Dictionary["reportShare"];
}

// Runs client-side because the QR's access token travels in the URL fragment
// (#t=...), which browsers never send to the server — this reads it, trades
// it for a session cookie, then does a real navigation (not router.refresh(),
// which doesn't reliably pick up a cookie set via fetch() right after a
// manual history.replaceState) to the clean URL so the server component
// re-renders with the cookie now present.
export function ShareExchange({ publicId, dict }: ShareExchangeProps) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
      if (!token) {
        if (!cancelled) setError(dict.missingToken);
        return;
      }

      try {
        const res = await fetch("/api/public/report-access/exchange", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicId, token }),
        });
        if (cancelled) return;
        if (!res.ok) {
          setError(dict.invalidOrExpired);
          return;
        }
        window.location.replace(`/r/${publicId}`);
      } catch {
        if (!cancelled) setError(dict.invalidOrExpired);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [publicId, dict]);

  if (error) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-danger/20 bg-danger-soft px-4 py-3.5 text-sm font-medium text-danger">
        <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-10 text-ink-muted">
      <Loader2 aria-hidden className="size-6 animate-spin" />
      <p className="text-sm">{dict.verifying}</p>
    </div>
  );
}
