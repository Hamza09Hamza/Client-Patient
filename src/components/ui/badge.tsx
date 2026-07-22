import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  BadgeCheck,
  Check,
  Clock3,
  FlaskConical,
} from "lucide-react";
import type { ResultStatus, ValueFlag } from "@prisma/client";
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

const VALUE_FLAG_META: Record<ValueFlag, { classes: string; Icon: typeof Check }> = {
  NORMAL: { classes: "bg-accent-soft text-accent-strong", Icon: Check },
  LOW: { classes: "bg-info-soft text-info", Icon: ArrowDown },
  HIGH: { classes: "bg-warn-soft text-warn", Icon: ArrowUp },
  CRITICAL: { classes: "bg-danger-soft text-danger", Icon: AlertTriangle },
};

const VALUE_FLAG_LABEL_EN: Record<ValueFlag, string> = {
  NORMAL: "Normal",
  LOW: "Low",
  HIGH: "High",
  CRITICAL: "Critical",
};
const VALUE_FLAG_LABEL_FR: Record<ValueFlag, string> = {
  NORMAL: "Normal",
  LOW: "Bas",
  HIGH: "Élevé",
  CRITICAL: "Critique",
};

export async function ValueFlagBadge({ flag }: { flag: ValueFlag }) {
  const locale = await getLocale();
  const label = (locale === "fr" ? VALUE_FLAG_LABEL_FR : VALUE_FLAG_LABEL_EN)[flag];
  const { classes, Icon } = VALUE_FLAG_META[flag];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );
}

export async function PatientStatusBadge({ active }: { active: boolean }) {
  const dict = getDictionary(await getLocale()).adminPatients;
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
      <Check aria-hidden className="size-3.5" />
      {dict.active}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
      <AlertTriangle aria-hidden className="size-3.5" />
      {dict.disabled}
    </span>
  );
}
