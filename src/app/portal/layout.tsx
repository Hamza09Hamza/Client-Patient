import type { ReactNode } from "react";
import Link from "next/link";
import { requirePatient } from "@/lib/dal";
import { BrandLockup } from "@/components/brand";
import { PortalNavLinks } from "@/components/portal/nav";
import { LogoutButton } from "@/components/logout-button";
import { LocaleSwitcher } from "@/components/i18n/locale-switcher";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await requirePatient();
  const locale = await getLocale();
  const dict = getDictionary(locale);

  return (
    <div className="flex min-h-dvh flex-col">
      {/* The masthead is solid marine, not a translucent white bar: once a
          patient signs in, every page they see sits on clinic letterhead.
          The seal-red rule underneath is the same device that separates
          masthead from body on the sign-in panel. */}
      <header className="no-print on-marine sticky top-0 z-40 bg-primary-deep text-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/portal" aria-label={dict.portalNav.overview} className="shrink-0">
            <BrandLockup compact tone="light" />
          </Link>

          <PortalNavLinks dict={dict.portalNav} className="hidden items-center gap-1 md:flex" />

          <div className="flex shrink-0 items-center gap-1.5">
            <LocaleSwitcher locale={locale} variant="light" />
            <span className="hidden items-center gap-2.5 rounded-lg bg-white/10 px-2.5 py-1.5 sm:flex">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-primary-deep">
                {session.name.charAt(0)}
              </span>
              <span className="leading-tight">
                <span className="block max-w-32 truncate text-[13px] font-semibold text-white">
                  {session.name}
                </span>
                <span className="issued block text-[10px] text-on-marine-dim">
                  {session.username}
                </span>
              </span>
            </span>
            <LogoutButton label={dict.common.signOut} tone="light" />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="border-t border-white/10 md:hidden">
          <PortalNavLinks
            dict={dict.portalNav}
            className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2"
          />
        </div>

        {/* Contained, not full-bleed: the red segment has to start where the
            mark starts or it reads as a stray dash in the corner. */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="letterhead-rule" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      <footer className="no-print border-t border-border py-5">
        <p className="mx-auto max-w-6xl px-4 text-center text-[13px] text-ink-faint sm:px-6">
          {dict.portalNav.footerDisclaimer}
        </p>
      </footer>
    </div>
  );
}
