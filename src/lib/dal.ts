import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

/** Authoritative guard for patient pages/actions. Redirects when invalid. */
export async function requirePatient(): Promise<SessionPayload> {
  const session = await getSession();
  if (session?.role !== "patient") redirect("/login");
  const patient = await db.patient.findUnique({
    where: { id: session.sub },
    select: { status: true },
  });
  if (!patient || patient.status === "DISABLED") redirect("/login");
  return session;
}

/** Authoritative guard for admin pages/actions. Redirects when invalid. */
export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession();
  if (session?.role !== "admin") redirect("/admin/login");
  const admin = await db.admin.findUnique({ where: { id: session.sub }, select: { id: true } });
  if (!admin) redirect("/admin/login");
  return session;
}
