import type { Metadata } from "next";
import { KeyRound } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { PageHeading } from "@/components/ui/page-heading";
import { FadeIn } from "@/components/rb/fade-in";

export async function generateMetadata(): Promise<Metadata> {
  const dict = getDictionary(await getLocale());
  return { title: dict.metadata.settings };
}

export default async function SettingsPage() {
  const session = await requirePatient();
  const locale = await getLocale();
  const dict = getDictionary(locale).portalSettings;
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
    { label: dict.dateOfBirth, value: formatDate(patient.dateOfBirth, locale) },
    ...(patient.lastLoginDevice
      ? [{ label: dict.lastSignIn, value: patient.lastLoginDevice }]
      : []),
  ];

  return (
    <div className="space-y-6">
      <FadeIn>
        <PageHeading title={dict.title} subtitle={dict.subtitle} />
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Card className="p-6">
            <h2 className="font-display text-[17px] font-semibold text-ink">
              {dict.personalDetailsTitle}
            </h2>
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
              <h2 className="font-display text-[17px] font-semibold text-ink">
                {dict.resetPasswordTitle}
              </h2>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{dict.resetPasswordDesc}</p>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
