"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * Portal navigation. Lives on the marine masthead, so the active item is
 * marked with the seal red rather than a filled pill — the same red that
 * rules the login letterhead, doing the same job here: this is the live one.
 */
export function PortalNavLinks({
  dict,
  className,
}: {
  dict: Dictionary["portalNav"];
  className?: string;
}) {
  const pathname = usePathname();
  const links: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
    { href: "/portal", label: dict.overview, Icon: LayoutDashboard, exact: true },
    { href: "/portal/results", label: dict.myResults, Icon: FlaskConical },
    { href: "/portal/settings", label: dict.settings, Icon: Settings },
  ];
  return (
    <div className={className}>
      {links.map(({ href, label, Icon, exact }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`relative flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-200 ${
              active ? "text-white" : "text-on-marine-dim hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-seal"
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
