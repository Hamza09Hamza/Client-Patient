"use server";

import { randomBytes } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import { join, extname } from "path";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

export interface ResetRequestState {
  ok?: boolean;
  error?: string;
}

const schema = z.object({
  patientId: z.string().trim().min(3, "Enter your patient ID").max(100),
  email: z.string().trim().email("Enter a valid email address").max(200),
  note: z
    .string()
    .trim()
    .min(20, "Please explain in a few sentences why you are requesting a reset (at least 20 characters)")
    .max(2000),
});

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
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const limited = rateLimit(`reset-request:${ip}`, 3, 3600);
  if (!limited.allowed) {
    return { error: "Too many requests from this connection. Please try again later." };
  }

  const parsed = schema.safeParse({
    patientId: formData.get("patientId"),
    email: formData.get("email"),
    note: formData.get("note"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { error: "Attach a photo of your ID document so the clinic can verify you." };
  }
  const ext = ALLOWED_TYPES[photo.type];
  if (!ext || extname(photo.name).length > 6) {
    return { error: "The ID photo must be a JPEG, PNG, or WebP image." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return { error: "The ID photo must be smaller than 8 MB." };
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
