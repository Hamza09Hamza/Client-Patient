import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";
import { ResultStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { ResultStatus } from "@prisma/client";

export interface ResultRowData {
  id: string;
  reference: string;
  testName: string;
  category: string;
  status: ResultStatus;
  collectedAt: Date;
  abnormalCount?: number;
}

export function ResultRow({ result }: { result: ResultRowData }) {
  return (
    <Link
      href={`/portal/results/${result.id}`}
      className="group flex items-center gap-4 rounded-xl px-3 py-3.5 transition-colors duration-200 hover:bg-primary-wash"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft transition-colors group-hover:bg-primary group-hover:text-white text-primary">
        <FlaskConical aria-hidden className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">
          {result.testName}
        </span>
        <span className="mt-0.5 block text-[13px] text-ink-muted">
          {result.category} · {result.reference} · {formatDate(result.collectedAt)}
        </span>
      </span>
      {result.abnormalCount != null && result.abnormalCount > 0 && (
        <span className="hidden shrink-0 rounded-full bg-warn-soft px-2.5 py-1 text-xs font-semibold text-warn sm:block">
          {result.abnormalCount} flagged
        </span>
      )}
      <span className="shrink-0">
        <ResultStatusBadge status={result.status} />
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}
