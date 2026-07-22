"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  ScrollText,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";

export function AdminNavLinks({
  dict,
  pendingRequests,
  className,
}: {
  dict: Dictionary["adminNav"];
  pendingRequests: number;
  className?: string;
}) {
  const pathname = usePathname();
  const links: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
    { href: "/admin", label: dict.dashboard, Icon: LayoutDashboard, exact: true },
    { href: "/admin/patients", label: dict.patients, Icon: Users },
    { href: "/admin/results", label: dict.labResults, Icon: FlaskConical },
    { href: "/admin/requests", label: dict.resetRequests, Icon: KeyRound },
    { href: "/admin/audit", label: dict.auditLog, Icon: ScrollText },
    { href: "/admin/settings", label: dict.settings, Icon: Settings },
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
            className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors duration-200 ${
              active
                ? "bg-white/12 text-white"
                : "text-cyan-100/70 hover:bg-white/8 hover:text-white"
            }`}
          >
            <Icon aria-hidden className="size-4.5" />
            <span className="flex-1">{label}</span>
            {href === "/admin/requests" && pendingRequests > 0 && (
              <span
                aria-label={`${pendingRequests} pending`}
                className="tnum flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-amber-950"
              >
                {pendingRequests}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
