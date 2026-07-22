import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FlaskConical } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatAge, formatDate, formatRelative } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PatientStatusBadge, ResultStatusBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import {
  EditPatientButton,
  RegeneratePasswordButton,
  SyncDocumentsButton,
  ToggleStatusButton,
  ViewPasswordButton,
} from "./patient-actions";

export const metadata: Metadata = { title: "Patient" };

export default async function AdminPatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const dict = getDictionary(await getLocale());
  const d = dict.adminPatientDetail;

  const patient = await db.patient.findUnique({
    where: { id },
    include: {
      results: { orderBy: { collectedAt: "desc" }, take: 15 },
      _count: { select: { results: true } },
    },
  });
  if (!patient) notFound();

  const clientPatient = {
    id: patient.id,
    patientId: patient.patientId,
    fullName: patient.fullName,
    email: patient.email,
    phone: patient.phone,
    dateOfBirth: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null,
    gender: patient.gender,
    active: patient.status === "ACTIVE",
  };

  const details = [
    { label: d.email, value: patient.email ?? "—" },
    { label: d.phone, value: patient.phone ?? "—" },
    {
      label: d.dateOfBirth,
      value: patient.dateOfBirth
        ? `${formatDate(patient.dateOfBirth)} (${formatAge(patient.dateOfBirth)})`
        : "—",
    },
    { label: d.gender, value: patient.gender ?? "—" },
    { label: d.registered, value: formatDate(patient.createdAt) },
    {
      label: d.lastSignIn,
      value: patient.lastLoginAt ? formatRelative(patient.lastLoginAt) : dict.adminPatients.never,
    },
    ...(patient.lastLoginDevice ? [{ label: d.lastDevice, value: patient.lastLoginDevice }] : []),
  ];

  return (
    <div className="space-y-6">
      <FadeIn>
        <Link
          href="/admin/patients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {d.allPatients}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
            {patient.fullName}
          </h1>
          <PatientStatusBadge active={patient.status === "ACTIVE"} />
        </div>
        <p className="tnum mt-1 text-[15px] text-ink-muted">
          {patient.patientId} · {patient._count.results} report
          {patient._count.results === 1 ? "" : "s"}
        </p>
      </FadeIn>

      <FadeIn delay={0.08} className="flex flex-wrap gap-2.5">
        <EditPatientButton patient={clientPatient} dict={d} />
        <ViewPasswordButton patient={clientPatient} dict={d} credentialsDict={dict.credentials} />
        <RegeneratePasswordButton patient={clientPatient} dict={d} credentialsDict={dict.credentials} />
        <SyncDocumentsButton patient={clientPatient} dict={d} />
        <ToggleStatusButton patient={clientPatient} dict={d} />
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-3">
        <FadeIn delay={0.14}>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">{d.details}</h2>
            <dl className="mt-4 space-y-3.5">
              {details.map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
                  <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </FadeIn>

        <FadeIn delay={0.2} className="lg:col-span-2">
          <Card>
            <div className="border-b border-border px-5 py-4">
              <h2 className="font-semibold text-ink">{d.recentReports}</h2>
            </div>
            {patient.results.length === 0 ? (
              <EmptyState icon={FlaskConical} title={d.emptyTitle} description={d.emptyDesc} />
            ) : (
              <ul className="divide-y divide-border/70">
                {patient.results.map((r) => (
                  <li key={r.id} className="flex items-center gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-ink">{r.testName}</p>
                      <p className="tnum mt-0.5 text-[13px] text-ink-muted">
                        {r.category} · {r.reference} · {formatDate(r.collectedAt)}
                      </p>
                    </div>
                    <ResultStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
