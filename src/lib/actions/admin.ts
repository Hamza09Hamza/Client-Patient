"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/dal";
import { generatePassword, verifyPassword } from "@/lib/password";
import { audit } from "@/lib/audit";
import { syncPatientDocumentsCore } from "@/lib/document-sync";
import type { ValueFlag } from "@prisma/client";

export interface AdminActionState {
  ok?: boolean;
  error?: string;
  /** one-time generated credential — shown once, never retrievable again */
  password?: string;
  patientId?: string;
  documentsSynced?: number;
}

// ---------- Patients ----------

const patientSchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(3, "Patient ID must be at least 3 characters")
    .max(60)
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers, and dashes"),
  fullName: z.string().trim().min(2, "Enter the patient's full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(200).or(z.literal("")),
  phone: z.string().trim().max(40).or(z.literal("")),
  dateOfBirth: z.string().or(z.literal("")),
  gender: z.string().trim().max(20).or(z.literal("")),
});

export async function createPatient(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const parsed = patientSchema.safeParse({
    patientId: formData.get("patientId"),
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await db.patient.findUnique({ where: { patientId: data.patientId } });
  if (existing) return { error: `Patient ID ${data.patientId} already exists.` };

  const password = generatePassword();
  await db.patient.create({
    data: {
      patientId: data.patientId,
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
      password,
      mustChangePassword: true,
    },
  });

  await audit("ADMIN", admin.username, "PATIENT_CREATED", data.patientId);
  revalidatePath("/admin/patients");
  return { ok: true, password, patientId: data.patientId };
}

export async function updatePatient(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const parsed = patientSchema.omit({ patientId: true }).safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    dateOfBirth: formData.get("dateOfBirth") ?? "",
    gender: formData.get("gender") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return { error: "Patient not found." };

  await db.patient.update({
    where: { id },
    data: {
      fullName: data.fullName,
      email: data.email || null,
      phone: data.phone || null,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
      gender: data.gender || null,
    },
  });

  await audit("ADMIN", admin.username, "PATIENT_UPDATED", patient.patientId);
  revalidatePath(`/admin/patients/${id}`);
  revalidatePath("/admin/patients");
  return { ok: true };
}

export async function regeneratePatientPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return { error: "Patient not found." };

  const password = generatePassword();
  await db.patient.update({
    where: { id },
    data: { password, mustChangePassword: true },
  });

  await audit("ADMIN", admin.username, "PASSWORD_REGENERATED", patient.patientId);
  revalidatePath(`/admin/patients/${id}`);
  return { ok: true, password, patientId: patient.patientId };
}

/**
 * Returns the patient's current password as stored. Every call is
 * audit-logged since reading a live credential is itself a sensitive action.
 */
export async function viewPatientPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return { error: "Patient not found." };

  await audit("ADMIN", admin.username, "PASSWORD_VIEWED", patient.patientId);
  return { ok: true, password: patient.password, patientId: patient.patientId };
}

/** Manually re-pull a patient's document history from the clinic's own system. */
export async function syncPatientDocuments(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return { error: "Patient not found." };

  const result = await syncPatientDocumentsCore(patient.id, patient.patientId, "ADMIN", admin.username);
  if (!result.ok) return { error: result.error };

  revalidatePath(`/admin/patients/${id}`);
  return { ok: true, documentsSynced: result.count };
}

export async function togglePatientStatus(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const patient = await db.patient.findUnique({ where: { id } });
  if (!patient) return { error: "Patient not found." };

  const next = patient.status === "ACTIVE" ? "DISABLED" : "ACTIVE";
  await db.patient.update({ where: { id }, data: { status: next } });

  await audit(
    "ADMIN",
    admin.username,
    next === "DISABLED" ? "PATIENT_DISABLED" : "PATIENT_ENABLED",
    patient.patientId,
  );
  revalidatePath(`/admin/patients/${id}`);
  revalidatePath("/admin/patients");
  return { ok: true };
}

// ---------- Lab results ----------

const VALUE_FLAGS: ValueFlag[] = ["NORMAL", "LOW", "HIGH", "CRITICAL"];

const resultSchema = z.object({
  patientDbId: z.string().min(1, "Choose a patient"),
  category: z.string().trim().min(2, "Enter a category").max(80),
  testName: z.string().trim().min(2, "Enter the test name").max(160),
  specimen: z.string().trim().max(80).or(z.literal("")),
  orderingPhysician: z.string().trim().max(120).or(z.literal("")),
  collectedAt: z.string().min(1, "Set the collection date"),
  status: z.enum(["PENDING", "COMPLETED", "REVIEWED"]),
  notes: z.string().trim().max(2000).or(z.literal("")),
});

export async function createResult(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const parsed = resultSchema.safeParse({
    patientDbId: formData.get("patientDbId"),
    category: formData.get("category"),
    testName: formData.get("testName"),
    specimen: formData.get("specimen") ?? "",
    orderingPhysician: formData.get("orderingPhysician") ?? "",
    collectedAt: formData.get("collectedAt"),
    status: formData.get("status"),
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const collectedAt = new Date(data.collectedAt);
  if (Number.isNaN(collectedAt.getTime())) return { error: "The collection date is invalid." };

  const patient = await db.patient.findUnique({ where: { id: data.patientDbId } });
  if (!patient) return { error: "Patient not found." };

  // dynamic analyte rows: values[i][field]
  const values: {
    analyte: string;
    value: string;
    unit: string | null;
    refRange: string | null;
    flag: ValueFlag;
    sortOrder: number;
  }[] = [];
  for (let i = 0; ; i++) {
    const analyte = formData.get(`values[${i}][analyte]`);
    if (analyte === null) break;
    const value = String(formData.get(`values[${i}][value]`) ?? "").trim();
    const name = String(analyte).trim();
    if (!name && !value) continue; // skip fully empty rows
    if (!name || !value) {
      return { error: `Row ${i + 1}: both analyte name and value are required.` };
    }
    const flagRaw = String(formData.get(`values[${i}][flag]`) ?? "NORMAL") as ValueFlag;
    values.push({
      analyte: name,
      value,
      unit: String(formData.get(`values[${i}][unit]`) ?? "").trim() || null,
      refRange: String(formData.get(`values[${i}][refRange]`) ?? "").trim() || null,
      flag: VALUE_FLAGS.includes(flagRaw) ? flagRaw : "NORMAL",
      sortOrder: values.length,
    });
  }
  if (data.status !== "PENDING" && values.length === 0) {
    return { error: "Add at least one analyte value, or set the status to In progress." };
  }

  // sequential accession number per year
  const year = collectedAt.getFullYear();
  const last = await db.labResult.findFirst({
    where: { reference: { startsWith: `LAB-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const nextNum = last ? parseInt(last.reference.split("-")[2], 10) + 1 : 1000;
  const reference = `LAB-${year}-${nextNum}`;

  await db.labResult.create({
    data: {
      reference,
      patientDbId: patient.id,
      category: data.category,
      testName: data.testName,
      specimen: data.specimen || null,
      orderingPhysician: data.orderingPhysician || null,
      status: data.status,
      collectedAt,
      reportedAt: data.status === "PENDING" ? null : new Date(),
      notes: data.notes || null,
      values: values.length ? { create: values } : undefined,
    },
  });

  await audit("ADMIN", admin.username, "RESULT_CREATED", reference, `patient=${patient.patientId}`);
  revalidatePath("/admin/results");
  revalidatePath(`/admin/patients/${patient.id}`);
  return { ok: true, patientId: reference };
}

export async function deleteResult(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const result = await db.labResult.findUnique({
    where: { id },
    include: { patient: { select: { patientId: true } } },
  });
  if (!result) return { error: "Result not found." };

  await db.labResult.delete({ where: { id } });
  await audit(
    "ADMIN",
    admin.username,
    "RESULT_DELETED",
    result.reference,
    `patient=${result.patient.patientId}`,
  );
  revalidatePath("/admin/results");
  return { ok: true };
}

// ---------- Password reset requests ----------

export async function approveResetRequest(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");

  const request = await db.passwordResetRequest.findUnique({
    where: { id },
    include: { patient: true },
  });
  if (!request) return { error: "Request not found." };
  if (request.status !== "PENDING") return { error: "This request was already reviewed." };
  if (!request.patient) {
    return { error: "No patient matches the submitted ID — deny the request instead." };
  }

  const password = generatePassword();
  await db.$transaction([
    db.patient.update({
      where: { id: request.patient.id },
      data: { password, mustChangePassword: true },
    }),
    db.passwordResetRequest.update({
      where: { id },
      data: { status: "APPROVED", reviewedBy: admin.username, reviewedAt: new Date() },
    }),
  ]);

  await audit("ADMIN", admin.username, "RESET_APPROVED", request.patient.patientId);
  revalidatePath("/admin/requests");
  return { ok: true, password, patientId: request.patient.patientId };
}

export async function denyResetRequest(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const reviewNote = String(formData.get("reviewNote") ?? "").trim();

  const request = await db.passwordResetRequest.findUnique({ where: { id } });
  if (!request) return { error: "Request not found." };
  if (request.status !== "PENDING") return { error: "This request was already reviewed." };

  await db.passwordResetRequest.update({
    where: { id },
    data: {
      status: "DENIED",
      reviewedBy: admin.username,
      reviewNote: reviewNote || null,
      reviewedAt: new Date(),
    },
  });

  await audit("ADMIN", admin.username, "RESET_DENIED", request.submittedPatientId, reviewNote);
  revalidatePath("/admin/requests");
  return { ok: true };
}

// ---------- Admin account ----------

const adminPasswordSchema = z
  .object({
    current: z.string().min(1, "Enter your current password"),
    next: z
      .string()
      .min(12, "Admin passwords must be at least 12 characters")
      .max(200)
      .regex(/[A-Za-z]/, "Include at least one letter")
      .regex(/[0-9]/, "Include at least one number"),
    confirm: z.string(),
  })
  .refine((d) => d.next === d.confirm, {
    message: "The confirmation does not match the new password",
    path: ["confirm"],
  });

export async function changeAdminPassword(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const session = await requireAdmin();

  const parsed = adminPasswordSchema.safeParse({
    current: formData.get("current"),
    next: formData.get("next"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = await db.admin.findUniqueOrThrow({ where: { id: session.sub } });
  if (!verifyPassword(parsed.data.current, admin.password)) {
    return { error: "Your current password is incorrect." };
  }

  await db.admin.update({
    where: { id: admin.id },
    data: { password: parsed.data.next },
  });
  await audit("ADMIN", session.username, "ADMIN_PASSWORD_CHANGED");
  return { ok: true };
}
