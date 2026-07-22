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

// Status always ships as icon + label — never color alone.

const RESULT_STATUS: Record<ResultStatus, { label: string; classes: string; Icon: typeof Check }> = {
  PENDING: { label: "In progress", classes: "bg-warn-soft text-warn", Icon: Clock3 },
  COMPLETED: { label: "Completed", classes: "bg-info-soft text-info", Icon: FlaskConical },
  REVIEWED: { label: "Reviewed", classes: "bg-accent-soft text-accent-strong", Icon: BadgeCheck },
};

export function ResultStatusBadge({ status }: { status: ResultStatus }) {
  const { label, classes, Icon } = RESULT_STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      <Icon aria-hidden className="size-3.5" />
      {label}
    </span>
  );
}

const VALUE_FLAG: Record<ValueFlag, { label: string; classes: string; Icon: typeof Check }> = {
  NORMAL: { label: "Normal", classes: "bg-accent-soft text-accent-strong", Icon: Check },
  LOW: { label: "Low", classes: "bg-info-soft text-info", Icon: ArrowDown },
  HIGH: { label: "High", classes: "bg-warn-soft text-warn", Icon: ArrowUp },
  CRITICAL: { label: "Critical", classes: "bg-danger-soft text-danger", Icon: AlertTriangle },
};

export function ValueFlagBadge({ flag }: { flag: ValueFlag }) {
  const { label, classes, Icon } = VALUE_FLAG[flag];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${classes}`}
    >
      <Icon aria-hidden className="size-3" />
      {label}
    </span>
  );
}

export function PatientStatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
      <Check aria-hidden className="size-3.5" />
      Active
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
      <AlertTriangle aria-hidden className="size-3.5" />
      Disabled
    </span>
  );
}
