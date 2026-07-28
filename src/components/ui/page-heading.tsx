import type { ReactNode } from "react";

/**
 * The title block every portal page opens with. Centralised so the four
 * pages can't drift apart on size, weight, or spacing — they had done
 * exactly that before.
 */
export function PageHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[32px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}
