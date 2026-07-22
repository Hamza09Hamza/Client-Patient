import { Activity } from "lucide-react";

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-xl bg-primary text-white shadow-sm ${className ?? "size-10"}`}
    >
      <Activity aria-hidden className="size-[55%]" strokeWidth={2.4} />
    </span>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark className={compact ? "size-8" : "size-10"} />
      <span className="leading-tight">
        <span className={`block font-semibold text-ink ${compact ? "text-[15px]" : "text-lg"}`}>
          Meridian Clinic
        </span>
        {!compact && (
          <span className="block text-xs font-medium tracking-wide text-ink-muted">
            Laboratory Portal
          </span>
        )}
      </span>
    </span>
  );
}
