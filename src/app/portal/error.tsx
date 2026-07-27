"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "@/lib/i18n/locale-types";

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return match?.[1] === "fr" ? "fr" : DEFAULT_LOCALE;
}

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [dict] = useState(() => getDictionary(readLocaleCookie()).errorBoundary);

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <Card className="w-full max-w-md p-8 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-soft">
          <AlertTriangle aria-hidden className="size-6 text-danger" />
        </div>
        <h1 className="mt-4 text-lg font-bold text-ink">{dict.title}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{dict.description}</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={() => (window.location.href = "/portal")}>
            {dict.backToOverview}
          </Button>
          <Button onClick={reset}>
            <RotateCw aria-hidden className="size-4" />
            {dict.retry}
          </Button>
        </div>
      </Card>
    </div>
  );
}
