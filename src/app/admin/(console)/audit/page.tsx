import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import type { ActorType, Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { FadeIn } from "@/components/rb/fade-in";
import { AuditFilter } from "./audit-filter";

export const metadata: Metadata = { title: "Audit log" };

const PAGE_SIZE = 25;
const ACTOR_TYPES: ActorType[] = ["ADMIN", "PATIENT", "SYSTEM"];

const ACTOR_STYLES: Record<ActorType, string> = {
  ADMIN: "bg-primary-soft text-primary-deep",
  PATIENT: "bg-accent-soft text-accent-strong",
  SYSTEM: "bg-info-soft text-info",
};

interface AuditSearchParams {
  actor?: string;
  page?: string;
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const where: Prisma.AuditLogWhereInput = {};
  if (params.actor && ACTOR_TYPES.includes(params.actor as ActorType)) {
    where.actorType = params.actor as ActorType;
  }

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const [entries, totalCount] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hrefFor = (p: number) => {
    const query = new URLSearchParams();
    if (params.actor) query.set("actor", params.actor);
    query.set("page", String(p));
    return `/admin/audit?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Audit log</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Every sign-in, view, download, and administrative change — {totalCount} entries.
        </p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <AuditFilter />
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          {entries.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title="No entries"
              description="Activity will be recorded here as the portal is used."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-165 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-5 py-3.5 font-semibold">When</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Actor</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Action</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Target</th>
                    <th scope="col" className="px-5 py-3.5 font-semibold">Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="tnum whitespace-nowrap px-5 py-3 text-[13px] text-ink-muted">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`mr-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${ACTOR_STYLES[entry.actorType]}`}
                        >
                          {entry.actorType}
                        </span>
                        <span className="text-sm font-medium text-ink">{entry.actorId}</span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded-md bg-canvas px-1.5 py-0.5 text-[12px] font-semibold text-primary-deep">
                          {entry.action}
                        </code>
                      </td>
                      <td className="tnum px-4 py-3 text-sm text-ink">{entry.target ?? "—"}</td>
                      <td className="max-w-56 truncate px-5 py-3 text-[13px] text-ink-muted">
                        {entry.detail ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </FadeIn>

      <Pagination page={page} totalPages={totalPages} hrefFor={hrefFor} />
    </div>
  );
}
