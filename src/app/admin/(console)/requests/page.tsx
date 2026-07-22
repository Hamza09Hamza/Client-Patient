import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Inbox, KeyRound, Mail, UserRound } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { FadeIn } from "@/components/rb/fade-in";
import { ApproveRequestButton, DenyRequestButton } from "./request-review";

export const metadata: Metadata = { title: "Reset requests" };

export default async function ResetRequestsPage() {
  await requireAdmin();
  const fullDict = getDictionary(await getLocale());
  const dict = fullDict.adminRequests;

  const [pending, reviewed] = await Promise.all([
    db.passwordResetRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      include: { patient: { select: { id: true, fullName: true, patientId: true } } },
    }),
    db.passwordResetRequest.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { reviewedAt: "desc" },
      take: 15,
      include: { patient: { select: { fullName: true } } },
    }),
  ]);

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
          {dict.title}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">{dict.subtitle}</p>
      </FadeIn>

      {pending.length === 0 ? (
        <FadeIn delay={0.08}>
          <Card>
            <EmptyState icon={Inbox} title={dict.emptyTitle} description={dict.emptyDesc} />
          </Card>
        </FadeIn>
      ) : (
        <div className="space-y-5">
          {pending.map((request, i) => (
            <FadeIn key={request.id} delay={0.08 + i * 0.06}>
              <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-primary-wash px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <KeyRound aria-hidden className="size-4.5 text-primary" />
                    <span className="tnum font-semibold text-ink">{request.submittedPatientId}</span>
                    {request.patient ? (
                      <Link
                        href={`/admin/patients/${request.patient.id}`}
                        className="text-sm font-medium text-primary-deep underline-offset-4 hover:underline"
                      >
                        {request.patient.fullName}
                      </Link>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                        <AlertTriangle aria-hidden className="size-3.5" />
                        {dict.noMatch}
                      </span>
                    )}
                  </div>
                  <span className="text-[13px] text-ink-faint">
                    {formatRelative(request.createdAt)}
                  </span>
                </div>

                <div className="grid gap-5 p-5 sm:grid-cols-[200px_1fr]">
                  <a
                    href={`/admin/files/${request.idPhotoPath}`}
                    target="_blank"
                    rel="noreferrer"
                    className="group relative block overflow-hidden rounded-xl border border-border"
                    aria-label="Open the ID document in a new tab"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/admin/files/${request.idPhotoPath}`}
                      alt={`ID document submitted by ${request.submittedPatientId}`}
                      className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-ink/60 px-2.5 py-1.5 text-center text-[11px] font-medium text-white">
                      Click to inspect full size
                    </span>
                  </a>

                  <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail aria-hidden className="size-4 shrink-0 text-primary" />
                      <a
                        href={`mailto:${request.email}`}
                        className="truncate font-medium text-primary-deep underline-offset-4 hover:underline"
                      >
                        {request.email}
                      </a>
                    </div>
                    <div className="flex items-start gap-2 text-sm">
                      <UserRound aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
                      <p className="leading-relaxed text-ink">{request.note}</p>
                    </div>
                    <div className="flex gap-2.5 pt-1">
                      <ApproveRequestButton
                        dict={fullDict}
                        request={{
                          id: request.id,
                          submittedPatientId: request.submittedPatientId,
                          email: request.email,
                          patientName: request.patient?.fullName ?? null,
                        }}
                      />
                      <DenyRequestButton
                        dict={dict}
                        request={{
                          id: request.id,
                          submittedPatientId: request.submittedPatientId,
                          email: request.email,
                          patientName: request.patient?.fullName ?? null,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>
          ))}
        </div>
      )}

      {reviewed.length > 0 && (
        <FadeIn delay={0.2}>
          <Card>
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-ink">{dict.reviewHistory}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-150 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-5 py-3 font-semibold">{dict.colPatientId}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{dict.colOutcome}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{dict.colReviewedBy}</th>
                    <th scope="col" className="px-4 py-3 font-semibold">{dict.colWhen}</th>
                    <th scope="col" className="px-5 py-3 font-semibold">{dict.colNote}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {reviewed.map((r) => (
                    <tr key={r.id}>
                      <td className="tnum px-5 py-3 text-sm font-semibold text-ink">
                        {r.submittedPatientId}
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "APPROVED" ? (
                          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                            {dict.approved}
                          </span>
                        ) : (
                          <span className="rounded-full bg-danger-soft px-2.5 py-1 text-xs font-semibold text-danger">
                            {dict.denied}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-ink">{r.reviewedBy ?? "—"}</td>
                      <td className="px-4 py-3 text-[13px] text-ink-muted">
                        {formatDateTime(r.reviewedAt)}
                      </td>
                      <td className="max-w-60 truncate px-5 py-3 text-[13px] text-ink-muted">
                        {r.reviewNote ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </FadeIn>
      )}
    </div>
  );
}
