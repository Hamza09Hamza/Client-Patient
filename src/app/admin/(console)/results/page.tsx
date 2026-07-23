import type { Metadata } from "next";
import Link from "next/link";
import { FlaskConical } from "lucide-react";
import type { Prisma, ResultStatus } from "@prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, t } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { ResultStatusBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import { ResultsToolbar } from "./results-toolbar";
import { DeleteResultButton } from "./delete-result-button";

export const metadata: Metadata = { title: "Lab results" };

const PAGE_SIZE = 12;
const STATUSES: ResultStatus[] = ["PENDING", "COMPLETED", "REVIEWED"];

interface ResultsSearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function AdminResultsPage({
  searchParams,
}: {
  searchParams: Promise<ResultsSearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const fullDict = getDictionary(await getLocale());
  const dict = fullDict.adminResults;

  const where: Prisma.LabResultWhereInput = {};
  if (params.q) {
    where.OR = [
      { reference: { contains: params.q, mode: "insensitive" } },
      { testName: { contains: params.q, mode: "insensitive" } },
      { category: { contains: params.q, mode: "insensitive" } },
      { patient: { fullName: { contains: params.q, mode: "insensitive" } } },
      { patient: { patientId: { contains: params.q, mode: "insensitive" } } },
    ];
  }
  if (params.status && STATUSES.includes(params.status as ResultStatus)) {
    where.status = params.status as ResultStatus;
  }

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const [results, totalCount] = await Promise.all([
    db.labResult.findMany({
      where,
      orderBy: { collectedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { patient: { select: { id: true, fullName: true, patientId: true } } },
    }),
    db.labResult.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hrefFor = (p: number) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(p));
    return `/admin/results?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">{dict.title}</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {t(totalCount === 1 ? dict.reportCount : dict.reportCountPlural, { count: totalCount })}{" "}
          {dict.subtitle}
        </p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <ResultsToolbar dict={fullDict} />
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          {results.length === 0 ? (
            <EmptyState icon={FlaskConical} title={dict.emptyTitle} description={dict.emptyDesc} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-175 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-5 py-3.5 font-semibold">{dict.colReport}</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">{dict.colPatient}</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">{dict.colCategory}</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">{dict.colCollected}</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">{dict.colStatus}</th>
                    <th scope="col" className="px-3 py-3.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {results.map((r) => (
                    <tr key={r.id} className="transition-colors hover:bg-primary-wash">
                      <td className="px-5 py-3.5">
                        <span className="block text-[15px] font-semibold text-ink">{r.testName}</span>
                        <span className="tnum block text-[13px] text-ink-muted">{r.reference}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/admin/patients/${r.patient.id}`}
                          className="text-[14px] font-medium text-primary-deep underline-offset-4 hover:underline"
                        >
                          {r.patient.fullName}
                        </Link>
                        <span className="tnum block text-[13px] text-ink-muted">
                          {r.patient.patientId}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-[14px] text-ink">{r.category}</td>
                      <td className="px-4 py-3.5 text-[13px] text-ink-muted">
                        {formatDate(r.collectedAt)}
                      </td>
                      <td className="px-4 py-3.5">
                        <ResultStatusBadge status={r.status} />
                      </td>
                      <td className="px-3 py-3.5">
                        <DeleteResultButton
                          resultId={r.id}
                          reference={r.reference}
                          patientName={r.patient.fullName}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </FadeIn>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
