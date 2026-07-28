import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { daysAgo, formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { EmptyState } from "@/components/ui/empty-state";
import { ResultStatusBadge } from "@/components/ui/badge";
import { CountUp } from "@/components/rb/count-up";
import { FadeIn } from "@/components/rb/fade-in";
import { ResultRow } from "@/components/portal/result-row";

export const metadata: Metadata = { title: "Overview" };

function greetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export default async function PortalHomePage() {
  const session = await requirePatient();
  const monthAgo = daysAgo(30);
  const dict = getDictionary(await getLocale()).portalHome;

  const [total, recentCount, pendingCount, latest] = await Promise.all([
    db.labResult.count({ where: { patientDbId: session.sub } }),
    db.labResult.count({ where: { patientDbId: session.sub, collectedAt: { gte: monthAgo } } }),
    db.labResult.count({ where: { patientDbId: session.sub, status: "PENDING" } }),
    db.labResult.findMany({
      where: { patientDbId: session.sub },
      orderBy: { collectedAt: "desc" },
      take: 6,
    }),
  ]);

  const [headline, ...earlier] = latest;
  const firstName = session.name.split(" ")[0];

  // The header line of a patient's file, not four dashboard tiles. These
  // counts are context for the report below, so they get one compact strip
  // instead of a grid of cards competing with the thing the patient
  // actually came here to open.
  const record = [
    { label: dict.reportsOnFile, value: total },
    { label: dict.newThisMonth, value: recentCount },
    { label: dict.inProgress, value: pendingCount },
  ];

  return (
    <div className="space-y-7">
      <FadeIn>
        <PageHeading title={`${dict[greetingKey()]}, ${firstName}`} subtitle={dict.subtitle} />
      </FadeIn>

      <FadeIn delay={0.06}>
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-card sm:grid-cols-4">
          {record.map(({ label, value }, i) => (
            <div key={label} className="bg-surface px-5 py-4">
              <dt className="text-[13px] font-medium text-ink-muted">{label}</dt>
              <dd className="issued mt-1.5 text-[26px] font-semibold leading-none text-ink">
                <CountUp to={value} delay={0.12 + i * 0.06} />
              </dd>
            </div>
          ))}
          <div className="bg-surface px-5 py-4">
            <dt className="text-[13px] font-medium text-ink-muted">{dict.lastCollection}</dt>
            <dd className="issued mt-1.5 text-[15px] font-semibold leading-tight text-ink">
              {headline ? formatDate(headline.collectedAt) : "—"}
            </dd>
          </div>
        </dl>
      </FadeIn>

      {!headline ? (
        <FadeIn delay={0.12}>
          <Card>
            <EmptyState icon={FlaskConical} title={dict.emptyTitle} description={dict.emptyDesc} />
          </Card>
        </FadeIn>
      ) : (
        <>
          {/* The most recent report carries the weight — it is the reason a
              patient opened this page at all. */}
          <FadeIn delay={0.12}>
            <Link
              href={`/portal/results/${headline.id}`}
              className="group block overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition-shadow duration-200 hover:shadow-raised"
            >
              <span className="flex items-start gap-4 border-b border-border bg-primary-wash px-5 py-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <FlaskConical aria-hidden className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="issued block text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    {dict.latestReport}
                  </span>
                  <span className="mt-1 block font-display text-xl font-semibold leading-tight tracking-tight text-ink">
                    {headline.testName}
                  </span>
                </span>
                <ResultStatusBadge status={headline.status} />
              </span>

              <dl className="grid gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-3">
                {[
                  {
                    label: dict.collectedLabel,
                    value: formatDate(headline.collectedAt),
                    mono: true,
                  },
                  { label: dict.referenceLabel, value: headline.reference, mono: true },
                  { label: dict.categoryLabel, value: headline.category, mono: false },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                      {label}
                    </dt>
                    <dd
                      className={`mt-0.5 truncate text-sm font-semibold text-ink ${mono ? "issued" : ""}`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>

              <span className="flex items-center gap-1.5 border-t border-border px-5 py-3 text-sm font-semibold text-primary">
                {dict.openReport}
                <ArrowRight
                  aria-hidden
                  className="size-4 transition-transform duration-200 group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          </FadeIn>

          {earlier.length > 0 && (
            <FadeIn delay={0.2}>
              <Card>
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h2 className="font-display text-[17px] font-semibold text-ink">
                    {dict.earlierReports}
                  </h2>
                  <Link
                    href="/portal/results"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    {dict.viewAll}
                    <ArrowRight aria-hidden className="size-3.5" />
                  </Link>
                </div>
                <div className="divide-y divide-border/70 p-2">
                  {earlier.map((r) => (
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
              </Card>
            </FadeIn>
          )}
        </>
      )}
    </div>
  );
}
