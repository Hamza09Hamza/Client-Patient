import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { Aurora } from "@/components/rb/aurora";
import { SplitText } from "@/components/rb/split-text";
import { FadeIn } from "@/components/rb/fade-in";
import { Card } from "@/components/ui/card";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { AdminLoginForm } from "./admin-login-form";

export const metadata: Metadata = { title: "Administration" };

export default async function AdminLoginPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale).adminLogin;

  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-primary-deep px-5 py-10">
      <Aurora />

      <div className="absolute right-5 top-5">
        <LocaleSwitcher locale={locale} variant="light" />
      </div>

      <div className="relative w-full max-w-md">
        <FadeIn className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
            <ShieldCheck aria-hidden className="size-7 text-cyan-200" />
          </span>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            <SplitText text={dict.title} delay={0.1} stagger={0.025} />
          </h1>
          <FadeIn delay={0.8}>
            <p className="mt-2 text-[15px] text-cyan-100/80">{dict.subtitle}</p>
          </FadeIn>
        </FadeIn>

        <FadeIn delay={0.25}>
          <Card className="border-white/10 p-7 shadow-modal">
            <AdminLoginForm dict={dict} />
          </Card>
        </FadeIn>

        <FadeIn delay={0.45} className="mt-6 text-center">
          <Link
            href="/login"
            className="text-[13px] font-medium text-cyan-100/70 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {dict.patientLink}
          </Link>
        </FadeIn>
      </div>
    </main>
  );
}
