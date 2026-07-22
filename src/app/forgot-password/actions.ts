"use server";

import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";

export interface ResetRequestState {
  ok?: boolean;
  error?: string;
}

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function submitResetRequest(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const dict = getDictionary(await getLocale()).forgotPassword;
  const schema = z.object({
    patientId: z.string().trim().min(3, dict.enterPatientId).max(100),
    email: z.string().trim().email(dict.enterEmail).max(200),
    note: z.string().trim().min(20, dict.enterNote).max(2000),
  });

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`reset-request:${ip}`, 3, 3600);
  if (!limited.allowed) {
    return { error: dict.rateLimitError };
  }

  const parsed = schema.safeParse({
    patientId: formData.get("patientId"),
    email: formData.get("email"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: dict.attachPhoto };
  }
  const ext = ALLOWED_TYPES[photo.type];
  if (!ext || extname(photo.name).length > 6) {
    return { error: dict.photoType };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: dict.photoSize };
  }

  const uploadsDir = join(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const filename = `id-${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  await writeFile(join(uploadsDir, filename), Buffer.from(await photo.arrayBuffer()));

  // Look up the patient, but never reveal to the requester whether the ID exists.
  const patient = await db.patient.findUnique({
    where: { patientId: parsed.data.patientId },
    select: { id: true },
  });

  await db.passwordResetRequest.create({
    data: {
      submittedPatientId: parsed.data.patientId,
      patientDbId: patient?.id,
      email: parsed.data.email,
      note: parsed.data.note,
      idPhotoPath: filename,
    },
  });

  await audit("PATIENT", parsed.data.patientId, "RESET_REQUESTED", undefined, `ip=${ip}`);
  return { ok: true };
}
