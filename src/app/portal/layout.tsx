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
      <header className="no-print sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/portal" aria-label="Portal home">
            <BrandLockup compact />
          </Link>

          <PortalNavLinks dict={dict.portalNav} className="hidden items-center gap-1 md:flex" />

          <div className="flex items-center gap-2">
            <LocaleSwitcher locale={locale} />
            <span className="hidden items-center gap-2.5 rounded-xl bg-canvas px-3 py-1.5 sm:flex">
              <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                {session.name.charAt(0)}
              </span>
              <span className="leading-tight">
                <span className="block max-w-36 truncate text-[13px] font-semibold text-ink">
                  {session.name}
                </span>
                <span className="block text-[11px] text-ink-muted">{session.username}</span>
              </span>
            </span>
            <LogoutButton label={dict.common.signOut} />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="border-t border-border md:hidden">
          <PortalNavLinks
            dict={dict.portalNav}
            className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto px-4 py-2"
          />
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
