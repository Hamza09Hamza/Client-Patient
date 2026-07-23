import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/rb/fade-in";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requirePatient();
  const dict = getDictionary(await getLocale()).portalSettings;
  const patient = await db.patient.findUniqueOrThrow({
    where: { id: session.sub },
    select: {
      fullName: true,
      patientId: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      lastLoginDevice: true,
    },
  });

  const rows = [
    { label: dict.fullName, value: patient.fullName },
    { label: dict.patientId, value: patient.patientId },
    { label: dict.email, value: patient.email ?? "—" },
    { label: dict.phone, value: patient.phone ?? "—" },
    { label: dict.dateOfBirth, value: formatDate(patient.dateOfBirth) },
    ...(patient.lastLoginDevice
      ? [{ label: dict.lastSignIn, value: patient.lastLoginDevice }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">{dict.title}</h1>
        <p className="mt-1 text-[15px] text-ink-muted">{dict.subtitle}</p>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">{dict.personalDetailsTitle}</h2>
            <p className="mt-1 text-[13px] text-ink-muted">{dict.personalDetailsDesc}</p>
            <dl className="mt-5 space-y-3.5">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-ink-muted">{label}</dt>
                  <dd className="text-right text-sm font-semibold text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <KeyRound aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">{dict.resetPasswordTitle}</h2>
            </div>
            <p className="mt-1 mb-5 text-[13px] text-ink-muted">{dict.resetPasswordDesc}</p>
            <Link
              href="/forgot-password"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-strong active:scale-[0.98]"
            >
              <KeyRound aria-hidden className="size-4" />
              {dict.resetPasswordButton}
            </Link>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
