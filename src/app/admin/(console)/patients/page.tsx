import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Users } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatDate, formatRelative } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { PatientStatusBadge } from "@/components/ui/badge";
import { FadeIn } from "@/components/rb/fade-in";
import { PatientsToolbar } from "./patients-toolbar";

export const metadata: Metadata = { title: "Patients" };

const PAGE_SIZE = 12;

interface PatientsSearchParams {
  q?: string;
  status?: string;
  page?: string;
  new?: string;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<PatientsSearchParams>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const where: Prisma.PatientWhereInput = {};
  if (params.q) {
    where.OR = [
      { fullName: { contains: params.q, mode: "insensitive" } },
      { patientId: { contains: params.q, mode: "insensitive" } },
      { email: { contains: params.q, mode: "insensitive" } },
    ];
  }
  if (params.status === "ACTIVE" || params.status === "DISABLED") {
    where.status = params.status;
  }

  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const [patients, totalCount] = await Promise.all([
    db.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { results: true } } },
    }),
    db.patient.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hrefFor = (p: number) => {
    const query = new URLSearchParams();
    if (params.q) query.set("q", params.q);
    if (params.status) query.set("status", params.status);
    query.set("page", String(p));
    return `/admin/patients?${query.toString()}`;
  };

  return (
    <div className="space-y-6">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Patients</h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          {totalCount} account{totalCount === 1 ? "" : "s"} — create new ones, review their
          reports, and manage access.
        </p>
      </FadeIn>

      <FadeIn delay={0.08}>
        <PatientsToolbar />
      </FadeIn>

      <FadeIn delay={0.15}>
        <Card>
          {patients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No patients found"
              description="Adjust the search, or register a new patient with the button above."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-175 text-left">
                <thead>
                  <tr className="border-b border-border text-[12px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-5 py-3.5 font-semibold">Patient</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Contact</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3.5 text-right font-semibold">Reports</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Last sign-in</th>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Registered</th>
                    <th scope="col" className="px-3 py-3.5">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/70">
                  {patients.map((p) => (
                    <tr key={p.id} className="group relative transition-colors hover:bg-primary-wash">
                      <td className="px-5 py-3.5">
                        <Link href={`/admin/patients/${p.id}`} className="after:absolute after:inset-0">
                          <span className="block text-[15px] font-semibold text-ink group-hover:text-primary-deep">
                            {p.fullName}
                          </span>
                          <span className="tnum block text-[13px] text-ink-muted">{p.patientId}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="block max-w-52 truncate text-[13px] text-ink">
                          {p.email ?? "—"}
                        </span>
                        <span className="block text-[13px] text-ink-muted">{p.phone ?? ""}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <PatientStatusBadge active={p.status === "ACTIVE"} />
                      </td>
                      <td className="tnum px-4 py-3.5 text-right text-[15px] font-semibold text-ink">
                        {p._count.results}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-ink-muted">
                        {p.lastLoginAt ? formatRelative(p.lastLoginAt) : "never"}
                      </td>
                      <td className="px-4 py-3.5 text-[13px] text-ink-muted">
                        {formatDate(p.createdAt)}
                      </td>
                      <td className="px-3 py-3.5">
                        <ChevronRight
                          aria-hidden
                          className="size-4 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                        />
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
