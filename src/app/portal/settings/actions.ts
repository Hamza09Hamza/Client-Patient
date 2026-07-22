"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { requirePatient } from "@/lib/dal";
import { hashPassword, verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";

export interface ChangePasswordState {
  ok?: boolean;
  error?: string;
}

const schema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(10, "The new password must be at least 10 characters")
      .max(200)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((data) => data.next === data.confirm, {
    message: "The confirmation does not match the new password",
    path: ["confirm"],
  });

export async function changePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await requirePatient();

  const parsed = schema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const patient = await db.patient.findUniqueOrThrow({ where: { id: session.sub } });
  if (!(await verifyPassword(parsed.data.current, patient.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }

  await db.patient.update({
    where: { id: patient.id },
    data: { passwordHash: await hashPassword(parsed.data.next), mustChangePassword: false },
  });
  await audit("PATIENT", session.username, "PASSWORD_CHANGED");
  return { ok: true };
}
