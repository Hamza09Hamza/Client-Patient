import type { Metadata } from "next";
import { cookies } from "next/headers";
import { AlertCircle, Clock3, FileX2 } from "lucide-react";
import { db } from "@/lib/db";
import { verifyShareSession, SHARE_COOKIE } from "@/lib/report-share";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, t } from "@/lib/i18n/dictionaries";
import { formatDateTime } from "@/lib/format";
import { BrandLockup } from "@/components/brand";
import { PdfViewer } from "@/components/portal/pdf-viewer";
import { ShareExchange } from "./share-exchange";

// Never indexable — each URL is a bearer credential to one patient's medical
// document. Redundant with the root layout's default and the X-Robots-Tag
// header in next.config.ts, but explicit here because this is the one route
// where getting it wrong actually matters. See docs/API.md "QR single-report
// sharing" and src/app/robots.ts.
export const metadata: Metadata = {
  title: "Shared report",
  robots: { index: false, follow: false, nocache: true },
};

// Deliberately minimal and self-contained: no nav to /portal, no patient
// history, no search, no account links — a QR grant authorizes exactly one
// report, never a patient's identity. See docs/API.md "QR single-report
// sharing".
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh justify-center bg-canvas px-4 py-10 sm:py-16">
      <div className="w-full max-w-2xl">
        <div className="mb-6 flex justify-center">
          <BrandLockup />
        </div>
        <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">{children}</div>
      </div>
    </main>
  );
}

function Notice({ icon: Icon, message }: { icon: typeof AlertCircle; message: string }) {
  return (
    <div className="px-6 py-14 text-center sm:px-8">
      <Icon aria-hidden className="mx-auto mb-3 size-8 text-ink-faint" />
      <p className="mx-auto max-w-sm text-sm font-medium text-ink-muted">{message}</p>
    </div>
  );
}

export default async function SharedReportPage({ params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const locale = await getLocale();
  const dict = getDictionary(locale).reportShare;
  const pdfDict = getDictionary(locale).pdfViewer;

  const grant = await db.reportShareGrant.findUnique({ where: { publicId } });

  if (!grant) {
    return (
      <Shell>
        <Notice icon={FileX2} message={dict.notFound} />
      </Shell>
    );
  }
  if (grant.revokedAt) {
    return (
      <Shell>
        <Notice icon={AlertCircle} message={dict.revoked} />
      </Shell>
    );
  }
  if (grant.expiresAt < new Date()) {
    return (
      <Shell>
        <Notice icon={AlertCircle} message={dict.expired} />
      </Shell>
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SHARE_COOKIE)?.value;
  const verifiedLabResultId = sessionToken ? await verifyShareSession(sessionToken, publicId) : null;

  if (!verifiedLabResultId || verifiedLabResultId !== grant.labResultId) {
    return (
      <Shell>
        <div className="px-6 py-10 sm:px-8">
          <ShareExchange publicId={publicId} dict={dict} />
        </div>
      </Shell>
    );
  }

  const result = await db.labResult.findUnique({ where: { id: grant.labResultId } });
  if (!result) {
    return (
      <Shell>
        <Notice icon={FileX2} message={dict.notFound} />
      </Shell>
    );
  }
  if (!result.pdfPath) {
    // Grant is valid and scoped to a real report slot — it just hasn't
    // received its PDF from the clinic system yet (see docs/API.md, the
    // report-delivery two-phase flow). Distinct from "not found": the QR
    // may already be on a physical card handed to the patient at intake.
    return (
      <Shell>
        <Notice icon={Clock3} message={dict.pending} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="border-b border-border/70 px-6 py-5 sm:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-wider text-primary">{result.category}</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-ink">{result.testName}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t(dict.collectedOn, { date: formatDateTime(result.collectedAt) })}</p>
      </div>
      <PdfViewer
        src={`/r/${publicId}/file`}
        downloadHref={`/r/${publicId}/file`}
        title={result.testName}
        dict={pdfDict}
        openLabel={dict.openInNewTab}
        downloadLabel={dict.downloadPdf}
      />
      <div className="border-t border-border bg-canvas px-6 py-4 sm:px-8">
        <p className="text-[12px] leading-relaxed text-ink-faint">{dict.footerNotice}</p>
      </div>
    </Shell>
  );
}
