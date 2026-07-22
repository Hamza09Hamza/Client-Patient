import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, FileText, ShieldCheck } from "lucide-react";
import { Aurora } from "@/components/rb/aurora";
import { SplitText } from "@/components/rb/split-text";
import { FadeIn } from "@/components/rb/fade-in";
import { BrandLockup, BrandMark } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const TRUST_POINTS = [
  {
    Icon: ShieldCheck,
    title: "Private by design",
    text: "Your results are encrypted and visible only to you and your clinic.",
  },
  {
    Icon: FileText,
    title: "Complete history",
    text: "Every report the laboratory has issued for you, in one place.",
  },
  {
    Icon: Clock3,
    title: "Available anytime",
    text: "Check results the moment they are validated — no waiting room.",
  },
];

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh">
      {/* Brand panel */}
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-primary-deep p-12 text-white lg:flex">
        <Aurora />
        <FadeIn className="relative">
          <span className="flex items-center gap-2.5">
            <BrandMark className="size-10 bg-white/10 backdrop-blur" />
            <span className="text-lg font-semibold">Meridian Clinic</span>
          </span>
        </FadeIn>

        <div className="relative max-w-lg">
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight xl:text-5xl">
            <SplitText text="Your results," delay={0.15} />
            <br />
            <SplitText text="whenever you need them." delay={0.5} />
          </h1>
          <FadeIn delay={1.15}>
            <p className="mt-5 text-lg leading-relaxed text-cyan-100/90">
              Secure access to your laboratory reports from the clinic — view, download,
              and share them with any physician.
            </p>
          </FadeIn>
        </div>

        <div className="relative space-y-5">
          {TRUST_POINTS.map(({ Icon, title, text }, i) => (
            <FadeIn key={title} delay={1.3 + i * 0.12} className="flex items-start gap-3.5">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 backdrop-blur">
                <Icon aria-hidden className="size-5 text-cyan-200" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="block text-sm leading-relaxed text-cyan-100/80">{text}</span>
              </span>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex w-full flex-col items-center justify-center px-5 py-10 lg:w-1/2">
        <div className="w-full max-w-md">
          <FadeIn className="mb-10 lg:hidden">
            <BrandLockup />
          </FadeIn>

          <FadeIn delay={0.1}>
            <h2 className="text-[28px] font-bold tracking-tight text-ink">Welcome back</h2>
            <p className="mt-1.5 mb-8 text-[15px] text-ink-muted">
              Sign in with the credentials provided by the clinic.
            </p>
          </FadeIn>

          <FadeIn delay={0.2}>
            <LoginForm />
          </FadeIn>
        </div>

        <FadeIn delay={0.4} className="absolute bottom-6 px-5 text-center">
          <p className="text-[13px] text-ink-faint">
            Clinic staff?{" "}
            <Link
              href="/admin/login"
              className="font-medium text-ink-muted underline-offset-4 hover:text-primary hover:underline"
            >
              Go to the administration console
            </Link>
          </p>
        </FadeIn>
      </section>
    </main>
  );
}
