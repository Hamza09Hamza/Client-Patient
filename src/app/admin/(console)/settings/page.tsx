import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Webhook } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/rb/fade-in";
import { AdminPasswordForm } from "./admin-password-form";

export const metadata: Metadata = { title: "Console settings" };

export default async function AdminSettingsPage() {
  const session = await requireAdmin();

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Settings</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Signed in as <span className="font-semibold text-ink">{session.username}</span>.
        </p>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <KeyRound aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">Console password</h2>
            </div>
            <p className="mt-1 mb-5 text-[13px] text-ink-muted">
              Use a long, unique password — this account controls every patient record.
            </p>
            <AdminPasswordForm />
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <Webhook aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">Laboratory integration</h2>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              External clinic systems can provision patients and push results through the
              integration API. Requests must carry the shared key in the{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                x-api-key
              </code>{" "}
              header (configured on the server as{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                INTEGRATION_API_KEY
              </code>
              ).
            </p>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="rounded-xl border border-border bg-canvas p-3">
                <dt className="font-semibold text-ink">POST /api/integration/patients</dt>
                <dd className="mt-0.5 text-ink-muted">
                  Verifies or creates a patient by ID and returns freshly generated
                  credentials.
                </dd>
              </div>
              <div className="rounded-xl border border-border bg-canvas p-3">
                <dt className="font-semibold text-ink">POST /api/integration/results</dt>
                <dd className="mt-0.5 text-ink-muted">
                  Pushes a validated laboratory report for an existing patient.
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary-wash p-3">
              <ShieldCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Rotate the key if it is ever exposed; every integration call is written to
                the audit log.
              </p>
            </div>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
