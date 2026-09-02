import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  ClipboardList,
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
import { isPhoneUserAgent } from "@/lib/device";
import { Card } from "@/components/ui/card";
import { ResultStatusBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import { BrandLockup } from "@/components/brand";
import { PdfViewer } from "@/components/portal/pdf-viewer";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.metadata.report };
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
      patient: { select: { fullName: true, patientId: true, dateOfBirth: true, gender: true } },
    },
  });
  if (!result) notFound();

  await audit("PATIENT", session.username, "RESULT_VIEWED", result.reference);

  // Phones (confirmed on real hardware: Samsung Internet renders a blank box
  // for the PDF, see pdf-viewer.tsx) skip this page entirely and land
  // straight on the file — same behavior as the QR share page.
  if (result.pdfPath) {
    const userAgent = (await headers()).get("user-agent");
    if (isPhoneUserAgent(userAgent)) {
      redirect(`/portal/results/${result.id}/file`);
    }
  }

  // `mono` marks the values the laboratory *issued* — identifiers a patient
  // may need to read back to the clinic over the phone.
  const meta = [
    {
      Icon: User,
      label: dict.patient,
      value: `${result.patient.fullName} (${result.patient.patientId})`,
    },
    { Icon: Microscope, label: dict.specimen, value: result.specimen ?? "—" },
    { Icon: Stethoscope, label: dict.physician, value: result.orderingPhysician ?? "—" },
    { Icon: ClipboardList, label: dict.reportNumber, value: result.reference, mono: true },
  ];

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
                <p className="issued text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {result.category}
                </p>
                <h1 className="mt-1.5 font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[30px]">
                  {result.testName}
                </h1>
                <p className="mt-2 text-sm text-ink-muted">
                  {dict.collected} {formatDateTime(result.collectedAt, locale)}
                  {result.reportedAt && (
                    <>
                      {" "}
                      · {dict.reported} {formatDateTime(result.reportedAt, locale)}
                    </>
                  )}
                </p>
              </div>
              <ResultStatusBadge status={result.status} />
            </div>

            <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {meta.map(({ Icon, label, value, mono }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <Icon aria-hidden className="size-4 shrink-0 text-primary" />
                  <dt className="shrink-0 text-[13px] font-medium text-ink-muted">{label}:</dt>
                  <dd className={`truncate text-[13px] font-semibold text-ink ${mono ? "issued" : ""}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Body: locally stored PDF, or an in-progress notice */}
          {result.pdfPath ? (
            <div>
              <div className="border-b border-border/70 px-6 py-4 sm:px-8">
                <p className="text-sm font-semibold text-ink">{dict.clinicSourceTitle}</p>
                <p className="mt-0.5 text-[13px] text-ink-muted">{dict.clinicSourceDesc}</p>
              </div>
              <PdfViewer
                src={`/portal/results/${result.id}/file`}
                downloadHref={`/portal/results/${result.id}/download`}
                title={result.testName}
                openLabel={dict.openOnClinicSystem}
                downloadLabel={dict.downloadPdf}
              />
            </div>
          ) : (
            <div className="px-6 py-12 text-center sm:px-8">
              <p className="font-semibold text-ink">{dict.inProgressTitle}</p>
              <p className="mt-1 text-sm text-ink-muted">{dict.inProgressDesc}</p>
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
