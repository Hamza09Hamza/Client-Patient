import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  FilePlus2,
  FlaskConical,
  KeyRound,
  UserPlus,
  Users,
} from "lucide-react";
import { requireAdmin } from "@/lib/dal";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CountUp } from "@/components/rb/count-up";
import { FadeIn } from "@/components/rb/fade-in";

export const metadata: Metadata = { title: "Admin dashboard" };

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "signed in",
  LOGOUT: "signed out",
  LOGIN_FAILED: "failed to sign in",
  PATIENT_CREATED: "created patient",
  PATIENT_UPDATED: "updated patient",
  PATIENT_DISABLED: "disabled patient",
  PATIENT_ENABLED: "re-enabled patient",
  PASSWORD_REGENERATED: "regenerated password for",
  PASSWORD_CHANGED: "changed their password",
  RESET_REQUESTED: "requested a password reset",
  RESET_APPROVED: "approved a reset for",
  RESET_DENIED: "denied a reset for",
  RESULT_CREATED: "recorded result",
  RESULT_DELETED: "deleted result",
  RESULT_VIEWED: "viewed result",
  RESULT_DOWNLOADED: "downloaded result",
  ADMIN_PASSWORD_CHANGED: "changed the console password",
  DATABASE_SEEDED: "seeded the database",
};

export default async function AdminDashboardPage() {
  const session = await requireAdmin();

  const [patientCount, activeCount, resultCount, pendingRequests, recentActivity] =
    await Promise.all([
      db.patient.count(),
      db.patient.count({ where: { status: "ACTIVE" } }),
      db.labResult.count(),
      db.passwordResetRequest.count({ where: { status: "PENDING" } }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  const stats = [
    { label: "Registered patients", value: patientCount, Icon: Users, context: "accounts provisioned" },
    { label: "Active accounts", value: activeCount, Icon: Activity, context: "able to sign in today" },
    { label: "Reports on file", value: resultCount, Icon: FlaskConical, context: "across all patients" },
    { label: "Pending resets", value: pendingRequests, Icon: KeyRound, context: "awaiting your review" },
  ];

  const quickActions = [
    { href: "/admin/patients?new=1", label: "Add a patient", Icon: UserPlus },
    { href: "/admin/results/new", label: "Record a result", Icon: FilePlus2 },
    { href: "/admin/requests", label: "Review reset requests", Icon: KeyRound },
  ];

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
          Welcome back, {session.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">
          Here is what is happening at the clinic today.
        </p>
      </FadeIn>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ label, value, Icon, context }, i) => (
          <FadeIn key={label} delay={0.08 + i * 0.07}>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-ink-muted">{label}</span>
                <Icon aria-hidden className="size-4.5 text-primary" />
              </div>
              <p className="mt-2 text-[32px] font-bold leading-none tracking-tight text-ink">
                <CountUp to={value} delay={0.15 + i * 0.07} />
              </p>
              <p className="mt-2 text-[13px] text-ink-faint">{context}</p>
            </Card>
          </FadeIn>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <FadeIn delay={0.2} className="lg:col-span-2">
          <Card className="p-5">
            <h2 className="font-semibold text-ink">Quick actions</h2>
            <div className="mt-4 space-y-2.5">
              {quickActions.map(({ href, label, Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="group flex items-center gap-3.5 rounded-xl border border-border p-3.5 transition-all duration-200 hover:border-primary/40 hover:bg-primary-wash"
                >
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon aria-hidden className="size-4.5" />
                  </span>
                  <span className="flex-1 text-sm font-semibold text-ink">{label}</span>
                  <ArrowRight
                    aria-hidden
                    className="size-4 text-ink-faint transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
                  />
                </Link>
              ))}
            </div>
          </Card>
        </FadeIn>

        <FadeIn delay={0.26} className="lg:col-span-3">
          <Card>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="font-semibold text-ink">Recent activity</h2>
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                Full audit log
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No activity yet"
                description="Actions taken in the portal and console will appear here."
              />
            ) : (
              <ul className="divide-y divide-border/70 px-5">
                {recentActivity.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-3 py-3">
                    <span
                      aria-hidden
                      className={`size-2 shrink-0 rounded-full ${
                        entry.action.includes("FAILED") || entry.action.includes("DENIED")
                          ? "bg-danger"
                          : entry.action.includes("CREATED") || entry.action.includes("APPROVED")
                            ? "bg-accent"
                            : "bg-primary"
                      }`}
                    />
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">
                      <span className="font-semibold">{entry.actorId}</span>{" "}
                      <span className="text-ink-muted">
                        {ACTION_LABELS[entry.action] ?? entry.action.toLowerCase().replaceAll("_", " ")}
                      </span>
                      {entry.target && <span className="font-semibold"> {entry.target}</span>}
                    </p>
                    <span className="shrink-0 text-[12px] text-ink-faint">
                      {formatRelative(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </FadeIn>
      </div>
    </div>
  );
}
