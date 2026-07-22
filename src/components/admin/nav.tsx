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

const LINKS: { href: string; label: string; Icon: LucideIcon; exact?: boolean }[] = [
  { href: "/admin", label: "Dashboard", Icon: LayoutDashboard, exact: true },
  { href: "/admin/patients", label: "Patients", Icon: Users },
  { href: "/admin/results", label: "Lab results", Icon: FlaskConical },
  { href: "/admin/requests", label: "Reset requests", Icon: KeyRound },
  { href: "/admin/audit", label: "Audit log", Icon: ScrollText },
  { href: "/admin/settings", label: "Settings", Icon: Settings },
];

export function AdminNavLinks({
  pendingRequests,
  className,
}: {
  pendingRequests: number;
  className?: string;
}) {
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
