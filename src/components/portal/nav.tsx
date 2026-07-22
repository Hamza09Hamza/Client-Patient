"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

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
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-200 ${
              active
                ? "bg-primary-soft text-primary-deep"
                : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </Link>
        );
      })}
    </div>
  );
}
