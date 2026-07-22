import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardList, Microscope, Stethoscope, User } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { ResultStatusBadge, ValueFlagBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import { BrandLockup } from "@/components/brand";
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Report" };

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePatient();
  const { id } = await params;

  const result = await db.labResult.findFirst({
    where: { id, patientDbId: session.sub },
    include: {
      values: { orderBy: { sortOrder: "asc" } },
      patient: { select: { fullName: true, patientId: true, dateOfBirth: true, gender: true } },
    },
  });
  if (!result) notFound();

  await audit("PATIENT", session.username, "RESULT_VIEWED", result.reference);

  const meta = [
    { Icon: User, label: "Patient", value: `${result.patient.fullName} (${result.patient.patientId})` },
    { Icon: Microscope, label: "Specimen", value: result.specimen ?? "—" },
    { Icon: Stethoscope, label: "Ordering physician", value: result.orderingPhysician ?? "—" },
    { Icon: ClipboardList, label: "Report number", value: result.reference },
  ];

  return (
    <div className="space-y-6">
      <FadeIn className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/portal/results"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          All results
        </Link>
        <ReportActions resultId={result.id} />
      </FadeIn>

      <FadeIn delay={0.08}>
        <Card className="print-area overflow-hidden">
          {/* Report header */}
          <div className="border-b border-border bg-primary-wash px-6 py-6 sm:px-8">
            <div className="mb-5 hidden print:block">
              <BrandLockup />
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">
                  {result.category}
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
                  {result.testName}
                </h1>
                <p className="mt-2 text-sm text-ink-muted">
                  Collected {formatDateTime(result.collectedAt)}
                  {result.reportedAt && <> · Reported {formatDateTime(result.reportedAt)}</>}
                </p>
              </div>
              <ResultStatusBadge status={result.status} />
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {meta.map(({ Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                  <dt className="text-[13px] font-medium text-ink-muted">{label}:</dt>
                  <dd className="text-[13px] font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Values table */}
          {result.status === "PENDING" ? (
            <div className="px-6 py-12 text-center sm:px-8">
              <p className="font-semibold text-ink">This analysis is still in progress.</p>
              <p className="mt-1 text-sm text-ink-muted">
                Values will appear here as soon as the laboratory validates them.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-6 py-3.5 font-semibold sm:px-8">Analyte</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-semibold">Result</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-semibold">Reference range</th>
                    <th scope="col" className="px-6 py-3.5 text-right font-semibold sm:px-8">Flag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {result.values.map((v) => (
                    <tr
                      key={v.id}
                      className={v.flag === "CRITICAL" ? "bg-danger-soft/40" : undefined}
                    >
                      <td className="px-6 py-3.5 text-[15px] font-medium text-ink sm:px-8">
                        {v.analyte}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right text-[15px] font-semibold text-ink">
                        {v.value}
                        {v.unit && (
                          <span className="ml-1 text-[13px] font-normal text-ink-muted">{v.unit}</span>
                        )}
                      </td>
                      <td className="tnum px-4 py-3.5 text-right text-[14px] text-ink-muted">
                        {v.refRange ?? "—"}
                        {v.unit && v.refRange && (
                          <span className="ml-1 text-[12px]">{v.unit}</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-right sm:px-8">
                        <ValueFlagBadge flag={v.flag} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.notes && (
            <div className="border-t border-border px-6 py-5 sm:px-8">
              <p className="text-[13px] font-semibold uppercase tracking-wider text-ink-muted">
                Laboratory notes
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{result.notes}</p>
            </div>
          )}

          <div className="border-t border-border bg-canvas px-6 py-4 sm:px-8">
            <p className="text-[12px] leading-relaxed text-ink-faint">
              This report is issued by the clinic laboratory. Values outside the reference
              range are flagged for your physician&apos;s attention — they are not a diagnosis
              on their own.
            </p>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
