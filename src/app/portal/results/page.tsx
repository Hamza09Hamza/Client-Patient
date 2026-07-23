import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import type { Prisma, ResultStatus } from "@prisma/client";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, t } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FadeIn } from "@/components/rb/fade-in";
import { ResultRow } from "@/components/portal/result-row";
import { FilterBar } from "./filter-bar";

export const metadata: Metadata = { title: "My results" };

const PAGE_SIZE = 10;
const STATUSES: ResultStatus[] = ["PENDING", "COMPLETED", "REVIEWED"];

interface ResultsSearchParams {
  q?: string;
  category?: string;
  status?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: string;
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59" : "00:00:00"}`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export default async function ResultsPage({
  searchParams,
}: {
  searchParams: Promise<ResultsSearchParams>;
}) {
  const session = await requirePatient();
  const params = await searchParams;
  const dict = getDictionary(await getLocale()).portalResults;

  const where: Prisma.LabResultWhereInput = { patientDbId: session.sub };

  if (params.q) {
    where.OR = [
      { testName: { contains: params.q, mode: "insensitive" } },
      { category: { contains: params.q, mode: "insensitive" } },
      { reference: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.category) where.category = params.category;
  if (params.status && STATUSES.includes(params.status as ResultStatus)) {
    where.status = params.status as ResultStatus;
  }
  const from = parseDate(params.from);
  const to = parseDate(params.to, true);
  if (from || to) where.collectedAt = { ...(from && { gte: from }), ...(to && { lte: to }) };

  const orderBy: Prisma.LabResultOrderByWithRelationInput =
    params.sort === "oldest"
      ? { collectedAt: "asc" }
      : params.sort === "name"
        ? { testName: "asc" }
        : params.sort === "category"
          ? { category: "asc" }
          : { collectedAt: "desc" };

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const [results, totalCount, categoryRows] = await Promise.all([
    db.labResult.findMany({
      where,
      orderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.labResult.count({ where }),
    db.labResult.findMany({
      where: { patientDbId: session.sub },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hrefFor = (p: number) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value && key !== "page") query.set(key, value);
    }
    query.set("page", String(p));
    return `/portal/results?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">{dict.title}</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {t(totalCount === 1 ? dict.reportCount : dict.reportCountPlural, { count: totalCount })} —{" "}
          {dict.subtitle}
        </p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <FilterBar dict={dict} categories={categoryRows.map((c) => c.category)} />
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          {results.length === 0 ? (
            <EmptyState icon={SearchX} title={dict.emptyTitle} description={dict.emptyDesc} />
          ) : (
            <div className="divide-y divide-border/70 p-2">
              {results.map((r) => (
                <ResultRow
                  key={r.id}
                  result={{
                    id: r.id,
                    reference: r.reference,
                    testName: r.testName,
                    category: r.category,
                    status: r.status,
                    collectedAt: r.collectedAt,
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </FadeIn>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
