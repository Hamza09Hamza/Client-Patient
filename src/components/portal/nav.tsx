"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, LayoutDashboard, Settings, type LucideIcon } from "lucide-react";

const LINKS: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
  { href: "/portal", label: "Overview", Icon: LayoutDashboard, exact: true },
  { href: "/portal/results", label: "My results", Icon: FlaskConical },
  { href: "/portal/settings", label: "Settings", Icon: Settings },
];

export function PortalNavLinks({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <div className={className}>
      {LINKS.map(({ href, label, Icon, exact }) => {
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
