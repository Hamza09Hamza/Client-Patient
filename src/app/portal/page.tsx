import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, FileCheck2, FlaskConical, Hourglass } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { daysAgo, formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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

  const [total, recentCount, pendingCount, latest, criticalRecent] = await Promise.all([
    db.labResult.count({ where: { patientDbId: session.sub } }),
    db.labResult.count({ where: { patientDbId: session.sub, collectedAt: { gte: monthAgo } } }),
    db.labResult.count({ where: { patientDbId: session.sub, status: "PENDING" } }),
    db.labResult.findMany({
      where: { patientDbId: session.sub },
      orderBy: { collectedAt: "desc" },
      take: 5,
      include: { _count: { select: { values: { where: { flag: { not: "NORMAL" } } } } } },
    }),
    db.labResultValue.count({
      where: {
        flag: "CRITICAL",
        result: { patientDbId: session.sub, collectedAt: { gte: monthAgo } },
      },
    }),
  ]);

  const lastCollection = latest[0]?.collectedAt ?? null;
  const firstName = session.name.split(" ")[0];

  const stats = [
    { label: dict.reportsOnFile, value: total, Icon: FileCheck2, context: dict.reportsOnFileContext },
    { label: dict.newThisMonth, value: recentCount, Icon: FlaskConical, context: dict.newThisMonthContext },
    { label: dict.inProgress, value: pendingCount, Icon: Hourglass, context: dict.inProgressContext },
  ];

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
          {dict[greetingKey()]}, {firstName}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">{dict.subtitle}</p>
      </FadeIn>

      {criticalRecent > 0 && (
        <FadeIn delay={0.05}>
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-danger/25 bg-danger-soft p-4"
          >
            <AlertTriangle aria-hidden className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="font-semibold text-danger">{dict.criticalAlertTitle}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-ink-muted">{dict.criticalAlertText}</p>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Stat tiles */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, context }, i) => (
          <FadeIn key={label} delay={0.08 + i * 0.07}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-muted">{label}</span>
                <Icon aria-hidden className="size-4.5 text-primary" />
              </div>
              <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-ink">
                <CountUp to={value} delay={0.15 + i * 0.07} />
              </p>
              <p className="mt-2 text-[13px] text-ink-faint">{context}</p>
            </Card>
          </FadeIn>
        ))}
        <FadeIn delay={0.29}>
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-muted">{dict.lastCollection}</span>
              <CalendarClock aria-hidden className="size-4.5 text-primary" />
            </div>
            <p className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-ink">
              {lastCollection ? formatDate(lastCollection) : "—"}
            </p>
            <p className="mt-2 text-[13px] text-ink-faint">{dict.lastCollectionContext}</p>
          </Card>
        </FadeIn>
      </div>

      {/* Latest reports */}
      <FadeIn delay={0.2}>
        <Card>
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-semibold text-ink">{dict.latestReports}</h2>
            <Link
              href="/portal/results"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              {dict.viewAll}
              <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </div>
          {latest.length === 0 ? (
            <EmptyState icon={FlaskConical} title={dict.emptyTitle} description={dict.emptyDesc} />
          ) : (
            <div className="divide-y divide-border/70 p-2">
              {latest.map((r) => (
                <ResultRow
                  key={r.id}
                  result={{
                    id: r.id,
                    reference: r.reference,
                    testName: r.testName,
                    category: r.category,
                    status: r.status,
                    collectedAt: r.collectedAt,
                    abnormalCount: r._count.values,
                  }}
                />
              ))}
            </div>
          )}
        </Card>
      </FadeIn>
    </div>
  );
}
