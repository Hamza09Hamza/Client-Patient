import { BadgeCheck, Check, Clock3, FlaskConical } from "lucide-react";
import type { ResultStatus } from "@prisma/client";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

// Status always ships as icon + label — never color alone.
// These are server components (no "use client") so they can localize
// themselves via cookies() without threading a locale prop through every
// call site — safe as long as none of them are imported into a client file.

const RESULT_STATUS_META: Record<ResultStatus, { classes: string; Icon: typeof Check }> = {
  PENDING: { classes: "bg-warn-soft text-warn", Icon: Clock3 },
  COMPLETED: { classes: "bg-info-soft text-info", Icon: FlaskConical },
  REVIEWED: { classes: "bg-accent-soft text-accent-strong", Icon: BadgeCheck },
};

export async function ResultStatusBadge({ status }: { status: ResultStatus }) {
  const dict = getDictionary(await getLocale()).portalResults;
  const label = { PENDING: dict.statusPending, COMPLETED: dict.statusCompleted, REVIEWED: dict.statusReviewed }[
    status
  ];
  const { classes, Icon } = RESULT_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}
