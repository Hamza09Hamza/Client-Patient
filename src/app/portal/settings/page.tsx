import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/rb/fade-in";
import { ChangePasswordForm } from "./change-password-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const session = await requirePatient();
  const patient = await db.patient.findUniqueOrThrow({
    where: { id: session.sub },
    select: { fullName: true, patientId: true, email: true, phone: true, dateOfBirth: true },
  });

  const rows = [
    { label: "Full name", value: patient.fullName },
    { label: "Patient ID", value: patient.patientId },
    { label: "Email", value: patient.email ?? "—" },
    { label: "Phone", value: patient.phone ?? "—" },
    { label: "Date of birth", value: formatDate(patient.dateOfBirth) },
  ];

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Your identity details and account security.
        </p>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Card className="p-6">
            <h2 className="font-semibold text-ink">Personal details</h2>
            <p className="mt-1 text-[13px] text-ink-muted">
              To correct any of these, contact the clinic reception.
            </p>
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
              <ShieldCheck aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">Change password</h2>
            </div>
            <p className="mt-1 mb-5 text-[13px] text-ink-muted">
              Pick something memorable — you will need it every time you sign in.
            </p>
            <ChangePasswordForm />
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
