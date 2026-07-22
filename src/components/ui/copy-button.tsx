"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable (e.g. insecure context) — select-and-copy fallback not needed here
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-all duration-200 ${
        copied
          ? "border-accent/40 bg-accent-soft text-accent-strong"
          : "border-border-strong bg-surface text-ink-muted hover:border-primary/40 hover:text-primary"
      }`}
    >
      {copied ? <Check aria-hidden className="size-3.5" /> : <Copy aria-hidden className="size-3.5" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
