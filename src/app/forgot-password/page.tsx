import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { FadeIn } from "@/components/rb/fade-in";
import { ResetRequestForm } from "./reset-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center px-5 py-10">
      <div className="w-full max-w-md">
        <FadeIn>
          <BrandLockup />
        </FadeIn>

        <FadeIn delay={0.1}>
          <Link
            href="/login"
            className="mt-10 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-primary"
          >
            <ArrowLeft aria-hidden className="size-4" />
            Back to sign in
          </Link>
          <h1 className="mt-3 text-[26px] font-bold tracking-tight text-ink">
            Request a password reset
          </h1>
          <p className="mt-1.5 mb-8 text-[15px] leading-relaxed text-ink-muted">
            For your safety, resets are reviewed by clinic staff. Tell us who you are and
            attach an ID document — you will receive new credentials by email once verified.
          </p>
        </FadeIn>

        <FadeIn delay={0.2}>
          <ResetRequestForm />
        </FadeIn>
      </div>
    </main>
  );
}
