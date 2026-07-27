import { redirect } from "next/navigation";
import { getSession, type SessionPayload } from "@/lib/session";
import { db } from "@/lib/db";

/** Authoritative guard for patient pages/actions. Redirects when invalid. */
export async function requirePatient(): Promise<SessionPayload> {
  const session = await getSession();
  if (session?.role !== "patient") redirect("/login");

  // A transient database error (connection blip, pool exhaustion) is not
  // proof the patient is disabled/deleted — surface it as a page error so
  // the user can retry, rather than silently bouncing a legitimate,
  // still-logged-in patient back to /login (see src/proxy.ts for the same
  // distinction made at the edge).
  let patient: { status: string } | null;
  try {
    patient = await db.patient.findUnique({
      where: { id: session.sub },
      select: { status: true },
    });
  } catch {
    throw new Error("Unable to verify your session right now. Please try again.");
  }
  if (!patient || patient.status === "DISABLED") redirect("/login");
  return session;
}
