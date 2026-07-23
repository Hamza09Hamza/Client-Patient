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
