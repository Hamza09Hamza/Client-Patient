import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import { generatePassword, hashPassword } from "@/lib/password";
import { audit } from "@/lib/audit";

const bodySchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9-]+$/, "patientId may only contain letters, numbers, and dashes"),
  fullName: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(200).optional(),
  phone: z.string().trim().max(40).optional(),
  dateOfBirth: z.string().date().optional(),
  gender: z.string().trim().max(20).optional(),
});

/**
 * Provision (or re-credential) a patient from the clinic's internal system.
 *
 * - If the patient ID is unknown, a patient record is created (fullName required)
 *   and credentials are generated.
 * - If the patient ID already exists, a fresh password is generated, replacing
 *   the previous one.
 *
 * The plaintext password exists only in this response — it is stored hashed.
 */
export async function POST(request: NextRequest) {
  const denied = checkIntegrationAuth(request);
  if (denied) return denied;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid payload.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 422 },
    );
  }
  const data = parsed.data;

  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  const existing = await db.patient.findUnique({ where: { patientId: data.patientId } });

  if (existing) {
    await db.patient.update({
      where: { id: existing.id },
      data: { passwordHash, mustChangePassword: true },
    });
    await audit("SYSTEM", "integration", "PASSWORD_REGENERATED", data.patientId);
    return NextResponse.json({
      patientId: existing.patientId,
      fullName: existing.fullName,
      password,
      created: false,
    });
  }

  if (!data.fullName) {
    return NextResponse.json(
      { error: "Unknown patientId — include fullName to create the patient." },
      { status: 404 },
    );
  }

  const patient = await db.patient.create({
    data: {
      patientId: data.patientId,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender ?? null,
      passwordHash,
      mustChangePassword: true,
    },
  });

  await audit("SYSTEM", "integration", "PATIENT_CREATED", patient.patientId);
  return NextResponse.json(
    { patientId: patient.patientId, fullName: patient.fullName, password, created: true },
    { status: 201 },
  );
}
