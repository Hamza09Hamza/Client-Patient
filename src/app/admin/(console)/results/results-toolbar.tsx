"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FilePlus2, Loader2, Search } from "lucide-react";
import { SelectField } from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function ResultsToolbar({ dict }: { dict: Dictionary }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const admin = dict.adminResults;
  const statuses = dict.portalResults;

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page");
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    debounceRef.current = setTimeout(() => setParams({ q: search }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchParams, setParams]);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={admin.searchPlaceholder}
          aria-label={admin.searchPlaceholder}
          className="h-11 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
        {isPending && (
          <Loader2
            aria-hidden
            className="absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-primary"
          />
        )}
      </div>

      <SelectField
        label="Status filter"
        hideLabel
        className="sm:w-44"
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParams({ status: e.target.value })}
      >
        <option value="">{statuses.anyStatus}</option>
        <option value="PENDING">{statuses.statusPending}</option>
        <option value="COMPLETED">{statuses.statusCompleted}</option>
        <option value="REVIEWED">{statuses.statusReviewed}</option>
      </SelectField>

      <Link
        href="/admin/results/new"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 select-none hover:bg-primary-strong active:scale-[0.98]"
      >
        <FilePlus2 aria-hidden className="size-4" />
        {admin.recordResult}
      </Link>
    </div>
  );
}
