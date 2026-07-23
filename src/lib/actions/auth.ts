"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPasswordHash } from "@/lib/password";
import { createSession, destroySession, getSession } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { describeDevice } from "@/lib/device";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/dictionaries";

export interface AuthFormState {
  error?: string;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

async function clientDevice(): Promise<string | null> {
  const h = await headers();
  return describeDevice(h.get("user-agent"));
}

export async function patientLogin(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const dict = getDictionary(await getLocale()).login;
  const credentialsSchema = z.object({
    username: z.string().trim().min(1, dict.enterUsername).max(100),
    password: z.string().min(1, dict.enterPassword).max(200),
  });

  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { username, password } = parsed.data;

  const ip = await clientIp();
  const limited = rateLimit(`login:${ip}:${username.toLowerCase()}`, 5, 300);
  if (!limited.allowed) {
    return { error: t(dict.rateLimitError, { minutes: Math.ceil(limited.retryAfter / 60) }) };
  }

  const patient = await db.patient.findUnique({ where: { patientId: username } });
  if (!patient || !(await verifyPasswordHash(password, patient.passwordHash))) {
    await audit("PATIENT", username, "LOGIN_FAILED", undefined, `ip=${ip}`);
    return { error: dict.genericError };
  }
  if (patient.status === "DISABLED") {
    return { error: dict.disabledError };
  }

  const device = await clientDevice();
  await db.patient.update({
    where: { id: patient.id },
    data: { lastLoginAt: new Date(), lastLoginDevice: device },
  });
  await createSession({
    sub: patient.id,
    username: patient.patientId,
    name: patient.fullName,
    role: "patient",
  });
  await audit("PATIENT", patient.patientId, "LOGIN", undefined, `ip=${ip}${device ? `, device=${device}` : ""}`);
  redirect("/portal");
}

export async function logout(): Promise<void> {
  const session = await getSession();
  if (session) {
    await audit("PATIENT", session.username, "LOGOUT");
  }
  await destroySession();
  redirect("/login");
}
