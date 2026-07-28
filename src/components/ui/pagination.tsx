import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** builds the href for a given page, e.g. keeping current filters */
  hrefFor: (page: number) => string;
  labels: {
    pagination: string;
    previous: string;
    next: string;
  };
}

export function Pagination({ page, totalPages, hrefFor, labels }: PaginationProps) {
  if (totalPages <= 1) return null;

  const item =
    "flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-medium transition-colors";

  // window of pages around the current one
  const pages: number[] = [];
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  for (let p = start; p <= Math.min(totalPages, start + 4); p++) pages.push(p);

  return (
    <nav aria-label={labels.pagination} className="flex items-center justify-center gap-1.5">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} aria-label={labels.previous} className={`${item} text-ink-muted hover:bg-primary-soft hover:text-primary-deep`}>
          <ChevronLeft aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={`${item} text-ink-faint/50`}>
          <ChevronLeft className="size-4" />
        </span>
      )}
      {pages.map((p) =>
        p === page ? (
          <span key={p} aria-current="page" className={`${item} bg-primary text-white`}>
            {p}
          </span>
        ) : (
          <Link key={p} href={hrefFor(p)} className={`${item} text-ink-muted hover:bg-primary-soft hover:text-primary-deep`}>
            {p}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={hrefFor(page + 1)} aria-label={labels.next} className={`${item} text-ink-muted hover:bg-primary-soft hover:text-primary-deep`}>
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      ) : (
        <span aria-hidden className={`${item} text-ink-faint/50`}>
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
