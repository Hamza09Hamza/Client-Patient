"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, destroySession, getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export interface AuthFormState {
  error?: string;
}

const credentialsSchema = z.object({
  username: z.string().trim().min(1, "Enter your ID").max(100),
  password: z.string().min(1, "Enter your password").max(200),
});

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

const GENERIC_ERROR = "Incorrect ID or password. Check both and try again.";

export async function patientLogin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, password } = parsed.data;

  const ip = await clientIp();
  const limited = rateLimit(`login:${ip}:${username.toLowerCase()}`, 5, 300);
  if (!limited.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfter / 60)} min.` };
  }

  const patient = await db.patient.findUnique({ where: { patientId: username } });
  if (!patient || !(await verifyPassword(password, patient.passwordHash))) {
    await audit("PATIENT", username, "LOGIN_FAILED", undefined, `ip=${ip}`);
    return { error: GENERIC_ERROR };
  }
  if (patient.status === "DISABLED") {
    return { error: "This account is disabled. Contact the clinic for assistance." };
  }

  await db.patient.update({ where: { id: patient.id }, data: { lastLoginAt: new Date() } });
  await createSession({
    sub: patient.id,
    username: patient.patientId,
    name: patient.fullName,
    role: "patient",
  });
  await audit("PATIENT", patient.patientId, "LOGIN", undefined, `ip=${ip}`);
  redirect("/portal");
}

export async function adminLogin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, password } = parsed.data;

  const ip = await clientIp();
  const limited = rateLimit(`admin-login:${ip}`, 5, 300);
  if (!limited.allowed) {
    return { error: `Too many attempts. Try again in ${Math.ceil(limited.retryAfter / 60)} min.` };
  }

  const admin = await db.admin.findUnique({ where: { username } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    await audit("ADMIN", username, "LOGIN_FAILED", undefined, `ip=${ip}`);
    return { error: GENERIC_ERROR };
  }

  await createSession({
    sub: admin.id,
    username: admin.username,
    name: admin.fullName,
    role: "admin",
  });
  await audit("ADMIN", admin.username, "LOGIN", undefined, `ip=${ip}`);
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    await audit(session.role === "admin" ? "ADMIN" : "PATIENT", session.username, "LOGOUT");
  }
  await destroySession();
  redirect(session?.role === "admin" ? "/admin/login" : "/login");
}
