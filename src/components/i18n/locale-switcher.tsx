"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setLocaleAction } from "@/lib/actions/locale";
import { LOCALES, type Locale } from "@/lib/i18n/locale-types";

interface LocaleSwitcherProps {
  locale: Locale;
  /** "light" for use on dark backgrounds (login hero) */
  variant?: "default" | "light";
}

export function LocaleSwitcher({ locale, variant = "default" }: LocaleSwitcherProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === locale || pending) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  }

  const isLight = variant === "light";

  return (
    <div
      role="group"
      aria-label="Language / Langue"
      className={`inline-flex items-center gap-0.5 rounded-lg p-0.5 text-[11px] font-bold ${
        isLight ? "bg-white/10" : "border border-border-strong bg-surface"
      }`}
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          disabled={pending}
          aria-pressed={locale === l}
          className={`rounded-md px-2 py-1 uppercase transition-colors duration-200 disabled:opacity-60 ${
            locale === l
              ? isLight
                ? "bg-white/20 text-white"
                : "bg-primary text-white"
              : isLight
                ? "text-cyan-100/70 hover:text-white"
                : "text-ink-muted hover:text-primary"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
