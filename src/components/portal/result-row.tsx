import Link from "next/link";
import { ChevronRight, FlaskConical } from "lucide-react";
import { ResultStatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import type { ResultStatus } from "@prisma/client";
import type { Locale } from "@/lib/i18n/locale-types";

export interface ResultRowData {
  id: string;
  reference: string;
  testName: string;
  category: string;
  status: ResultStatus;
  collectedAt: Date;
}

export function ResultRow({ result, locale }: { result: ResultRowData; locale: Locale }) {
  return (
    <Link
      href={`/portal/results/${result.id}`}
      className="group flex items-center gap-3.5 rounded-xl px-3 py-3.5 transition-colors duration-200 hover:bg-primary-wash sm:gap-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
        <FlaskConical aria-hidden className="size-4.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{result.testName}</span>
        <span className="mt-0.5 block truncate text-[13px] text-ink-muted">
          {result.category} · <span className="issued">{result.reference}</span> ·{" "}
          {formatDate(result.collectedAt, locale)}
        </span>
        {/* Narrow screens can't fit test name and badge on one line without
            truncating the name to nothing — so the badge drops below it. */}
        <span className="mt-2 flex sm:hidden">
          <ResultStatusBadge status={result.status} />
        </span>
      </span>
      <span className="hidden shrink-0 sm:block">
        <ResultStatusBadge status={result.status} />
      </span>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
      />
    </Link>
  );
}
