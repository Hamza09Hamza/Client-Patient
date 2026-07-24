import { NextResponse, type NextRequest } from "next/server";
import { Prisma, type Patient } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import { generatePassword, generateUsername, hashPassword } from "@/lib/password";
import { audit } from "@/lib/audit";

/** Username collisions are astronomically unlikely (8 chars from a 54-char
 * alphabet) but the column is unique, so retry on the rare conflict rather
 * than let it 500. */
async function createPatientWithUsername(
  data: Omit<Prisma.PatientUncheckedCreateInput, "username">,
): Promise<Patient> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.patient.create({ data: { ...data, username: generateUsername() } });
    } catch (err) {
      const target =
        err instanceof Prisma.PrismaClientKnownRequestError && Array.isArray(err.meta?.target)
          ? err.meta.target
          : [];
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002" && target.includes("username")) {
        continue;
      }
      throw err;
    }
  }
  throw new Error("Failed to generate a unique username after 5 attempts.");
}

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

  const existing = await db.patient.findUnique({ where: { patientId: data.patientId } });

  if (existing) {
    await audit("SYSTEM", "integration", "PATIENT_ALREADY_EXISTS", data.patientId);
    return NextResponse.json({
      patientId: existing.patientId,
      username: existing.username,
      fullName: existing.fullName,
      created: false,
    });
  }

  if (!data.fullName) {
    return NextResponse.json(
      { error: "Unknown patientId — include fullName to create the patient." },
      { status: 404 },
    );
  }

  // Credentials are generated exactly once, when the patient is first
  // provisioned. Repeating this endpoint for an existing patient is
  // idempotent and never changes or re-sends their password.
  const password = generatePassword();
  const passwordHash = await hashPassword(password);

  let patient: Patient;
  try {
    patient = await createPatientWithUsername({
      patientId: data.patientId,
      fullName: data.fullName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender ?? null,
      passwordHash,
    });
  } catch (error) {
    // Two copies of the same provisioning request may race. The winner owns
    // the one generated password; the loser returns the normal idempotent
    // existing-patient response and never returns a password it did not store.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const racedPatient = await db.patient.findUnique({ where: { patientId: data.patientId } });
      if (racedPatient) {
        await audit("SYSTEM", "integration", "PATIENT_ALREADY_EXISTS", data.patientId);
        return NextResponse.json({
          patientId: racedPatient.patientId,
          username: racedPatient.username,
          fullName: racedPatient.fullName,
          created: false,
        });
      }
    }
    throw error;
  }

  await audit("SYSTEM", "integration", "PATIENT_CREATED", patient.patientId);
  return NextResponse.json(
    {
      patientId: patient.patientId,
      username: patient.username,
      fullName: patient.fullName,
      password,
      created: true,
    },
    { status: 201 },
  );
}
