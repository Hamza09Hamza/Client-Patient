import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { BrandMark } from "@/components/brand";
import { AdminNavLinks } from "@/components/admin/nav";
import { LogOut } from "lucide-react";
import { logout } from "@/lib/actions/auth";

export default async function AdminConsoleLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();
  const pendingRequests = await db.passwordResetRequest.count({ where: { status: "PENDING" } });

  return (
    <div className="flex min-h-dvh">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-primary-deep lg:flex">
        <Link href="/admin" className="flex items-center gap-2.5 px-5 py-6" aria-label="Admin dashboard">
          <BrandMark className="size-9 bg-white/10 backdrop-blur" />
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-white">Meridian Clinic</span>
            <span className="block text-[11px] font-medium tracking-wide text-cyan-100/70">
              Administration
            </span>
          </span>
        </Link>

        <AdminNavLinks pendingRequests={pendingRequests} className="flex-1 space-y-1 px-3" />

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-bold text-cyan-100">
              {session.name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-[13px] font-semibold text-white">
                {session.name}
              </span>
              <span className="block text-[11px] text-cyan-100/60">{session.username}</span>
            </span>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className="flex size-9 items-center justify-center rounded-lg text-cyan-100/60 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut aria-hidden className="size-4.5" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-primary-deep lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <Link href="/admin" className="flex items-center gap-2" aria-label="Admin dashboard">
              <BrandMark className="size-8 bg-white/10" />
              <span className="text-sm font-semibold text-white">Administration</span>
            </Link>
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className="flex size-10 items-center justify-center rounded-lg text-cyan-100/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut aria-hidden className="size-4.5" />
              </button>
            </form>
          </div>
          <AdminNavLinks
            pendingRequests={pendingRequests}
            className="flex items-center gap-1 overflow-x-auto px-3 pb-2"
          />
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
