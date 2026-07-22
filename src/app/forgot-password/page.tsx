import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { FadeIn } from "@/components/rb/fade-in";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);

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
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
            {dict.forgotPassword.title}
          </h1>
          <p className="mt-1.5 mb-8 text-[15px] leading-relaxed text-ink-muted">
            {dict.forgotPassword.subtitle}
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <ResetRequestForm dict={dict.forgotPassword} />
        </FadeIn>
      </div>
    </main>
  );
}
