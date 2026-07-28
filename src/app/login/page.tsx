import type { Metadata } from "next";
import { Clock3, FileText, Mail, Phone, ShieldCheck } from "lucide-react";
import { LabReel } from "@/components/rb/lab-reel";
import { SplitText } from "@/components/rb/split-text";
import { FadeIn } from "@/components/rb/fade-in";
import { BrandLockup } from "@/components/brand";
import { CLINIC_CONTACT } from "@/lib/config";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { LoginForm } from "./login-form";

// The one page in this app worth search engines finding — everything else
// inherits a site-wide noindex default from the root layout. See src/app/robots.ts.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = getDictionary(locale).login;
  return {
    title: dict.signInButton,
    description: dict.heroSubtitle,
    robots: { index: true, follow: true },
    alternates: { canonical: "/login" },
  };
}

export default async function LoginPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

  const ASSURANCES = [
    { Icon: ShieldCheck, title: dict.login.trust1Title, text: dict.login.trust1Text },
    { Icon: FileText, title: dict.login.trust2Title, text: dict.login.trust2Text },
    { Icon: Clock3, title: dict.login.trust3Title, text: dict.login.trust3Text },
  ];

  const contactChip =
    "inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-[13px] font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary-wash";

  return (
    <main className="flex min-h-dvh flex-col lg:flex-row">
      {/* ── Letterhead panel ───────────────────────────────────────────────
          Masthead, statement, certification strip — the three bands of an
          issued document. A left-hand panel on desktop; on a phone it
          becomes the header band, so the laboratory is the first thing a
          patient sees there too. */}
      <section className="on-marine relative flex flex-col justify-between overflow-hidden bg-primary-deep px-6 py-8 text-white sm:px-8 lg:w-[52%] lg:px-10 lg:py-10 xl:px-14 xl:py-14">
        <LabReel />

        <FadeIn className="relative">
          <div className="flex items-start justify-between gap-4">
            <BrandLockup tone="light" subtitle={dict.common.laboratoryPortal} />
            <LocaleSwitcher locale={locale} variant="light" />
          </div>
          <div className="letterhead-rule mt-5 lg:mt-6" />
        </FadeIn>

        <div className="relative max-w-xl py-9 lg:py-10">
          <h1 className="font-display text-[2rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[2.5rem] lg:text-[2.75rem] xl:text-[3.4rem]">
            <SplitText text={dict.login.heroLine1} delay={0.15} />
            <br />
            <SplitText text={dict.login.heroLine2} delay={0.5} />
          </h1>
          <FadeIn delay={1.15}>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-on-marine lg:mt-6 lg:text-[17px]">
              {dict.login.heroSubtitle}
            </p>
          </FadeIn>
        </div>

        {/* The band of assurances at the foot of an official form — not three
            cards. Desktop only: on a phone this would push the actual sign-in
            fields below the fold. */}
        <div className="relative hidden gap-x-6 lg:grid lg:grid-cols-3">
          {ASSURANCES.map(({ Icon, title, text }, i) => (
            <FadeIn key={title} delay={1.3 + i * 0.12}>
              <span className="block h-px w-full bg-white/25" />
              <span className="mt-3.5 flex items-center gap-2">
                <Icon aria-hidden className="size-4 shrink-0 text-seal" />
                <span className="text-[13px] font-semibold tracking-tight text-white">{title}</span>
              </span>
              <span className="mt-1.5 block text-[13px] leading-relaxed text-on-marine-dim">
                {text}
              </span>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ── Form panel ─────────────────────────────────────────────────── */}
      <section className="relative flex w-full flex-col justify-center px-5 py-10 sm:px-8 lg:w-[48%] lg:px-14">
        <div className="mx-auto w-full max-w-104">
          <FadeIn delay={0.1}>
            <h2 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-ink sm:text-[2rem]">
              {dict.login.welcomeBack}
            </h2>
            <p className="mt-2 mb-8 text-[15px] leading-relaxed text-ink-muted">
              {dict.login.subtitle}
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <LoginForm dict={dict.login} />
          </FadeIn>

          {/* A locked-out patient can't self-serve — there's no reset flow by
              design (see AGENTS.md). So the only useful thing this page can
              do is put a human within one tap. */}
          <FadeIn delay={0.32}>
            <div className="mt-10 rounded-2xl border border-border bg-surface p-5 shadow-card">
              <p className="text-sm font-semibold text-ink">{dict.login.helpTitle}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                {dict.login.helpBody}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <a href={`tel:${CLINIC_CONTACT.phones[0].tel}`} className={contactChip}>
                  <Phone aria-hidden className="size-3.5" />
                  <span className="issued">{CLINIC_CONTACT.phones[0].display}</span>
                </a>
                <a href={`mailto:${CLINIC_CONTACT.email}`} className={contactChip}>
                  <Mail aria-hidden className="size-3.5" />
                  {dict.login.helpEmail}
                </a>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>
    </main>
  );
}
