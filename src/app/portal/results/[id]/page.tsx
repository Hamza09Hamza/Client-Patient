import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardList,
  FileWarning,
  Microscope,
  Stethoscope,
  User,
} from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { formatDateTime } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { ResultStatusBadge, ValueFlagBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import { BrandLockup } from "@/components/brand";
import { ReportActions } from "./report-actions";

export const metadata: Metadata = { title: "Report" };

function isOpenableUrl(link: string | null): link is string {
  if (!link) return false;
  try {
    const url = new URL(link);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default async function ResultDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requirePatient();
  const { id } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale).portalResultDetail;

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
    { Icon: User, label: dict.patient, value: `${result.patient.fullName} (${result.patient.patientId})` },
    { Icon: Microscope, label: dict.specimen, value: result.specimen ?? "—" },
    { Icon: Stethoscope, label: dict.physician, value: result.orderingPhysician ?? "—" },
    { Icon: ClipboardList, label: dict.reportNumber, value: result.reference },
  ];

  const fromClinicSystem = Boolean(result.sourceLink);
  const openable = isOpenableUrl(result.sourceLink);

  return (
    <div className="space-y-6">
      <FadeIn className="no-print flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/portal/results"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {dict.allResults}
        </Link>
        {!fromClinicSystem && (
          <ReportActions resultId={result.id} printLabel={dict.print} downloadLabel={dict.downloadPdf} />
        )}
      </FadeIn>

      <FadeIn delay={0.08}>
        <Card className="print-area overflow-hidden">
          {/* Report header */}
          <div className="border-b border-border bg-primary-wash px-6 py-6 sm:px-8">
            <div className="mb-5 hidden print:block">
              <BrandLockup subtitle={dict.reportNumber} />
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
                  {dict.collected} {formatDateTime(result.collectedAt)}
                  {result.reportedAt && (
                    <>
                      {" "}
                      · {dict.reported} {formatDateTime(result.reportedAt)}
                    </>
                  )}
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

          {/* Body: clinic-sourced PDF, in-progress notice, or the values table */}
          {fromClinicSystem ? (
            <div className="px-6 py-10 text-center sm:px-8">
              {openable ? (
                <>
                  <p className="font-semibold text-ink">{dict.clinicSourceTitle}</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{dict.clinicSourceDesc}</p>
                  <a
                    href={result.sourceLink!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="no-print mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-strong active:scale-[0.98]"
                  >
                    {dict.openOnClinicSystem}
                    <ArrowUpRight aria-hidden className="size-4" />
                  </a>
                </>
              ) : (
                <>
                  <FileWarning aria-hidden className="mx-auto mb-3 size-8 text-warn" />
                  <p className="font-semibold text-ink">{dict.notYetAvailableTitle}</p>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{dict.notYetAvailableDesc}</p>
                  <p className="mx-auto mt-3 max-w-md break-all rounded-lg bg-canvas px-3 py-2 font-mono text-[12px] text-ink-muted">
                    {result.sourceLink}
                  </p>
                </>
              )}
            </div>
          ) : result.status === "PENDING" ? (
            <div className="px-6 py-12 text-center sm:px-8">
              <p className="font-semibold text-ink">{dict.inProgressTitle}</p>
              <p className="mt-1 text-sm text-ink-muted">{dict.inProgressDesc}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-130 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-6 py-3.5 font-semibold sm:px-8">{dict.analyte}</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-semibold">{dict.result}</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-semibold">{dict.referenceRange}</th>
                    <th scope="col" className="px-6 py-3.5 text-right font-semibold sm:px-8">{dict.flag}</th>
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
                {dict.labNotes}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink">{result.notes}</p>
            </div>
          )}

          <div className="border-t border-border bg-canvas px-6 py-4 sm:px-8">
            <p className="text-[12px] leading-relaxed text-ink-faint">{dict.footerDisclaimer}</p>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
}
