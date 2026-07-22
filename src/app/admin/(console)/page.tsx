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
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary, t } from "@/lib/i18n/dictionaries";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CountUp } from "@/components/rb/count-up";
import { FadeIn } from "@/components/rb/fade-in";

export const metadata: Metadata = { title: "Admin dashboard" };

const ACTION_LABELS_EN: Record<string, string> = {
  LOGIN: "signed in",
  LOGOUT: "signed out",
  LOGIN_FAILED: "failed to sign in",
  PATIENT_CREATED: "created patient",
  PATIENT_UPDATED: "updated patient",
  PATIENT_DISABLED: "disabled patient",
  PATIENT_ENABLED: "re-enabled patient",
  PASSWORD_REGENERATED: "regenerated password for",
  PASSWORD_VIEWED: "viewed the password for",
  PASSWORD_CHANGED: "changed their password",
  RESET_REQUESTED: "requested a password reset",
  RESET_APPROVED: "approved a reset for",
  RESET_DENIED: "denied a reset for",
  RESULT_CREATED: "recorded result",
  RESULT_DELETED: "deleted result",
  RESULT_VIEWED: "viewed result",
  RESULT_DOWNLOADED: "downloaded result",
  DOCUMENTS_SYNCED: "synced clinic documents for",
  ADMIN_PASSWORD_CHANGED: "changed the console password",
  DATABASE_SEEDED: "seeded the database",
};

const ACTION_LABELS_FR: Record<string, string> = {
  LOGIN: "s'est connecté(e)",
  LOGOUT: "s'est déconnecté(e)",
  LOGIN_FAILED: "a échoué à se connecter",
  PATIENT_CREATED: "a créé le patient",
  PATIENT_UPDATED: "a mis à jour le patient",
  PATIENT_DISABLED: "a désactivé le patient",
  PATIENT_ENABLED: "a réactivé le patient",
  PASSWORD_REGENERATED: "a régénéré le mot de passe de",
  PASSWORD_VIEWED: "a consulté le mot de passe de",
  PASSWORD_CHANGED: "a changé son mot de passe",
  RESET_REQUESTED: "a demandé une réinitialisation de mot de passe",
  RESET_APPROVED: "a approuvé la réinitialisation de",
  RESET_DENIED: "a refusé la réinitialisation de",
  RESULT_CREATED: "a enregistré le résultat",
  RESULT_DELETED: "a supprimé le résultat",
  RESULT_VIEWED: "a consulté le résultat",
  RESULT_DOWNLOADED: "a téléchargé le résultat",
  DOCUMENTS_SYNCED: "a synchronisé les documents de la clinique pour",
  ADMIN_PASSWORD_CHANGED: "a changé le mot de passe de la console",
  DATABASE_SEEDED: "a initialisé la base de données",
};

export default async function AdminDashboardPage() {
  const session = await requireAdmin();
  const locale = await getLocale();
  const dict = getDictionary(locale).adminDashboard;
  const actionLabels = locale === "fr" ? ACTION_LABELS_FR : ACTION_LABELS_EN;

  const [patientCount, activeCount, resultCount, pendingRequests, recentActivity] =
    await Promise.all([
      db.patient.count(),
      db.patient.count({ where: { status: "ACTIVE" } }),
      db.labResult.count(),
      db.passwordResetRequest.count({ where: { status: "PENDING" } }),
      db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

  const stats = [
    { label: dict.registeredPatients, value: patientCount, Icon: Users, context: dict.registeredPatientsContext },
    { label: dict.activeAccounts, value: activeCount, Icon: Activity, context: dict.activeAccountsContext },
    { label: dict.reportsOnFile, value: resultCount, Icon: FlaskConical, context: dict.reportsOnFileContext },
    { label: dict.pendingResets, value: pendingRequests, Icon: KeyRound, context: dict.pendingResetsContext },
  ];

  const quickActions = [
    { href: "/admin/patients?new=1", label: dict.addPatient, Icon: UserPlus },
    { href: "/admin/results/new", label: dict.recordResult, Icon: FilePlus2 },
    { href: "/admin/requests", label: dict.reviewRequests, Icon: KeyRound },
  ];

  return (
    <div className="space-y-8">
      <FadeIn>
        <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-3xl">
          {t(dict.welcome, { name: session.name.split(" ")[0] })}
        </h1>
        <p className="mt-1 text-[15px] text-ink-muted">{dict.subtitle}</p>
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
            <h2 className="font-semibold text-ink">{dict.quickActions}</h2>
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
              <h2 className="font-semibold text-ink">{dict.recentActivity}</h2>
              <Link
                href="/admin/audit"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
              >
                {dict.fullAuditLog}
                <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            {recentActivity.length === 0 ? (
              <EmptyState icon={Activity} title={dict.emptyTitle} description={dict.emptyDesc} />
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
                        {actionLabels[entry.action] ?? entry.action.toLowerCase().replaceAll("_", " ")}
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
