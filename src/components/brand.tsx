import Image from "next/image";
import { CLINIC_NAME } from "@/lib/config";

/**
 * The clinic's identity, as it appears on its own letterhead.
 *
 * The mark is the real CA monogram (public/logo-mark.png, cropped from the
 * supplied logo.png — the original has ~25% dead margin on every side and
 * reads as a speck at header sizes). It has no alpha channel, so it always
 * sits on a white plaque; on the marine surfaces that reads correctly as a
 * mounted enamel badge rather than as a bug.
 *
 * The wordmark sets the given name in italic — that's how the clinic writes
 * itself on cliniqueamina.com ("Clinique *Amina*"), not a decision made here.
 */

const MARK_ASPECT = 265 / 197;

function Wordmark({ className }: { className?: string }) {
  const parts = CLINIC_NAME.trim().split(/\s+/);
  const given = parts.length > 1 ? parts.pop() : undefined;
  return (
    <span className={`font-display ${className ?? ""}`}>
      {parts.join(" ")}
      {given && <em className="italic">&nbsp;{given}</em>}
    </span>
  );
}

export function BrandMark({
  className,
  /** Rendered height of the plaque in px — the mark keeps its 1.35:1 ratio. */
  height = 52,
}: {
  className?: string;
  height?: number;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white px-1.5 ${className ?? ""}`}
      style={{ height, width: Math.round(height * MARK_ASPECT * 0.86) }}
    >
      <Image
        src="/logo-mark.png"
        alt=""
        aria-hidden
        width={265}
        height={197}
        priority
        className="h-full w-full object-contain"
      />
    </span>
  );
}

export function BrandLockup({
  compact = false,
  subtitle,
  tone = "dark",
}: {
  compact?: boolean;
  subtitle?: string;
  /** "light" for use on marine backgrounds. */
  tone?: "dark" | "light";
}) {
  const light = tone === "light";
  return (
    <span className="flex items-center gap-3">
      <BrandMark
        height={compact ? 38 : 52}
        className={light ? "shadow-plaque" : "ring-1 ring-border"}
      />
      <span className="leading-tight">
        <Wordmark
          className={`block font-semibold tracking-tight ${
            compact ? "text-[19px]" : "text-[26px]"
          } ${light ? "text-white" : "text-ink"}`}
        />
        {!compact && subtitle && (
          <span
            className={`issued mt-0.5 block text-[10px] font-medium uppercase tracking-[0.18em] ${
              light ? "text-on-marine-dim" : "text-ink-faint"
            }`}
          >
            {subtitle}
          </span>
        )}
      </span>
    </span>
  );
}
