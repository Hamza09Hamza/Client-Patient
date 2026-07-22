"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, RotateCcw, Search } from "lucide-react";
import { SelectField } from "@/components/ui/select";
import type { Dictionary } from "@/lib/i18n/dictionaries";

interface FilterBarProps {
  dict: Dictionary["portalResults"];
  categories: string[];
}

export function FilterBar({ dict, categories }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page"); // filter changes reset pagination
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );

  // debounce free-text search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const current = searchParams.get("q") ?? "";
    if (search === current) return;
    debounceRef.current = setTimeout(() => setParams({ q: search }), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, searchParams, setParams]);

  const hasFilters =
    !!searchParams.get("q") ||
    !!searchParams.get("category") ||
    !!searchParams.get("status") ||
    !!searchParams.get("from") ||
    !!searchParams.get("to") ||
    !!searchParams.get("sort");

  const dateInput =
    "h-11 w-full rounded-xl border border-border-strong bg-surface px-3.5 text-[15px] text-ink transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15";

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-ink-faint"
        />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={dict.searchPlaceholder}
          aria-label={dict.searchPlaceholder}
          className="h-12 w-full rounded-xl border border-border-strong bg-surface pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-faint transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15"
        />
        {isPending && (
          <Loader2
            aria-hidden
            className="absolute right-3.5 top-1/2 size-4.5 -translate-y-1/2 animate-spin text-primary"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <SelectField
          label="Category"
          hideLabel
          value={searchParams.get("category") ?? ""}
          onChange={(e) => setParams({ category: e.target.value })}
        >
          <option value="">{dict.allCategories}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Status"
          hideLabel
          value={searchParams.get("status") ?? ""}
          onChange={(e) => setParams({ status: e.target.value })}
        >
          <option value="">{dict.anyStatus}</option>
          <option value="PENDING">{dict.statusPending}</option>
          <option value="COMPLETED">{dict.statusCompleted}</option>
          <option value="REVIEWED">{dict.statusReviewed}</option>
        </SelectField>

        <div>
          <label htmlFor="filter-from" className="sr-only">
            From date
          </label>
          <input
            id="filter-from"
            type="date"
            value={searchParams.get("from") ?? ""}
            onChange={(e) => setParams({ from: e.target.value })}
            className={dateInput}
          />
        </div>
        <div>
          <label htmlFor="filter-to" className="sr-only">
            To date
          </label>
          <input
            id="filter-to"
            type="date"
            value={searchParams.get("to") ?? ""}
            onChange={(e) => setParams({ to: e.target.value })}
            className={dateInput}
          />
        </div>

        <SelectField
          label="Sort by"
          hideLabel
          value={searchParams.get("sort") ?? "newest"}
          onChange={(e) => setParams({ sort: e.target.value === "newest" ? "" : e.target.value })}
        >
          <option value="newest">{dict.sortNewest}</option>
          <option value="oldest">{dict.sortOldest}</option>
          <option value="name">{dict.sortNameAsc}</option>
          <option value="category">{dict.sortCategoryAsc}</option>
        </SelectField>

        <button
          type="button"
          onClick={() => {
            setSearch("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          disabled={!hasFilters}
          className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-border-strong bg-surface text-sm font-medium text-ink-muted transition-colors duration-200 hover:border-primary/40 hover:text-primary disabled:opacity-40"
        >
          <RotateCcw aria-hidden className="size-3.5" />
          {dict.reset}
        </button>
      </div>
    </div>
  );
}
