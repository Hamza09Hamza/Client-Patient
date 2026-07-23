import type { Metadata } from "next";
import { KeyRound, ShieldCheck, Webhook } from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, t } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { FadeIn } from "@/components/rb/fade-in";
import { AdminPasswordForm } from "./admin-password-form";

export const metadata: Metadata = { title: "Console settings" };

export default async function AdminSettingsPage() {
  const session = await requireAdmin();
  const dict = getDictionary(await getLocale()).adminSettings;

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">{dict.title}</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {t(dict.signedInAs, { username: session.username })}
        </p>
      </FadeIn>

      <div className="grid gap-6 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <KeyRound aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">{dict.consolePasswordTitle}</h2>
            </div>
            <p className="mt-1 mb-5 text-[13px] text-ink-muted">{dict.consolePasswordDesc}</p>
            <AdminPasswordForm />
          </Card>
        </FadeIn>

        <FadeIn delay={0.15}>
          <Card className="p-6">
            <div className="flex items-center gap-2.5">
              <Webhook aria-hidden className="size-5 text-primary" />
              <h2 className="font-semibold text-ink">{dict.integrationTitle}</h2>
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              External clinic systems provision patients through the integration API — reports
              themselves arrive separately via clinic source sync (below). Requests must carry
              the shared key as a Bearer token in the{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                Authorization
              </code>{" "}
              header —{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                Authorization: Bearer &lt;key&gt;
              </code>{" "}
              (configured on the server as{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                INTEGRATION_API_KEY
              </code>
              ). Full reference:{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                docs/API.md
              </code>
              .
            </p>
            <dl className="mt-4 space-y-2.5 text-[13px]">
              <div className="rounded-xl border border-border bg-canvas p-3">
                <dt className="font-semibold text-ink">POST /api/integration/patients</dt>
                <dd className="mt-0.5 text-ink-muted">
                  Verifies or creates a patient by ID, returns freshly generated
                  credentials, and — if the clinic source is configured below — automatically
                  pulls that patient&apos;s document history.
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

        <FadeIn delay={0.22} className="lg:col-span-2">
          <Card className="p-6">
            <h2 className="font-semibold text-ink">Clinic source (outbound sync)</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
              To pull each patient&apos;s document history from the clinic&apos;s own system,
              set{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                CLINIC_SOURCE_BASE_URL
              </code>{" "}
              and{" "}
              <code className="rounded bg-canvas px-1 py-0.5 text-[12px] font-semibold text-primary-deep">
                CLINIC_SOURCE_SHARED_SECRET
              </code>{" "}
              on the server. This app then signs a short-lived token and calls out to that
              system with the patient&apos;s ID whenever a patient is provisioned, and again
              anytime an admin clicks &quot;Sync from clinic system&quot; on a patient&apos;s
              page. Full contract: docs/API.md.
            </p>
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
