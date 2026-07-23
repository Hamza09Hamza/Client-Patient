import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Phone } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { FadeIn } from "@/components/rb/fade-in";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { passwordResetRequestsEnabled } from "@/lib/feature-flags";
import { CLINIC_PHONE } from "@/lib/config";
import { Card } from "@/components/ui/card";
import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const enabled = passwordResetRequestsEnabled();

  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10">
      <div className="w-full max-w-md">
        <FadeIn className="flex items-center justify-between">
          <BrandLockup subtitle={dict.common.laboratoryPortal} />
          <LocaleSwitcher locale={locale} />
        </FadeIn>

        <FadeIn delay={0.1}>
          <Link
            href="/login"
            className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
          >
            <ArrowLeft aria-hidden className="size-4" />
            {dict.forgotPassword.backToSignIn}
          </Link>
          {enabled ? (
            <>
              <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
                {dict.forgotPassword.title}
              </h1>
              <p className="mt-1.5 mb-8 text-[15px] leading-relaxed text-ink-muted">
                {dict.forgotPassword.subtitle}
              </p>
            </>
          ) : (
            <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
              {dict.forgotPassword.disabledTitle}
            </h1>
          )}
        </FadeIn>

        {enabled ? (
          <FadeIn delay={0.2}>
            <ResetRequestForm dict={dict.forgotPassword} />
          </FadeIn>
        ) : (
          <FadeIn delay={0.2}>
            <Card className="p-6 text-center">
              <Phone aria-hidden className="mx-auto mb-3 size-8 text-primary" />
              <p className="text-sm leading-relaxed text-ink-muted">{dict.forgotPassword.disabledDesc}</p>
              <a
                href={`tel:${CLINIC_PHONE.replace(/\s+/g, "")}`}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-white shadow-sm transition-all duration-200 hover:bg-primary-strong active:scale-[0.98]"
              >
                <Phone aria-hidden className="size-4" />
                {dict.forgotPassword.callClinic} — {CLINIC_PHONE}
              </a>
            </Card>
          </FadeIn>
        )}
      </div>
    </main>
  );
}
