import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import { audit } from "@/lib/audit";

const valueSchema = z.object({
  analyte: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(60),
  unit: z.string().trim().max(40).optional(),
  refRange: z.string().trim().max(60).optional(),
  flag: z.enum(["NORMAL", "LOW", "HIGH", "CRITICAL"]).default("NORMAL"),
});

const bodySchema = z.object({
  patientId: z.string().trim().min(3).max(60),
  category: z.string().trim().min(2).max(80),
  testName: z.string().trim().min(2).max(160),
  specimen: z.string().trim().max(80).optional(),
  orderingPhysician: z.string().trim().max(120).optional(),
  collectedAt: z.string().datetime({ offset: true }).or(z.string().date()),
  reportedAt: z.string().datetime({ offset: true }).optional(),
  status: z.enum(["PENDING", "COMPLETED", "REVIEWED"]).default("COMPLETED"),
  notes: z.string().trim().max(2000).optional(),
  values: z.array(valueSchema).max(100).default([]),
});

/** Push a validated laboratory report for an existing patient. */
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
      { error: "Invalid payload.", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 422 },
    );
  }
  const data = parsed.data;

  const patient = await db.patient.findUnique({ where: { patientId: data.patientId } });
  if (!patient) {
    return NextResponse.json(
      { error: "Unknown patientId — provision the patient first via /api/integration/patients." },
      { status: 404 },
    );
  }

  if (data.status !== "PENDING" && data.values.length === 0) {
    return NextResponse.json(
      { error: "A completed report needs at least one value (or send status PENDING)." },
      { status: 422 },
    );
  }

  const collectedAt = new Date(data.collectedAt);
  const year = collectedAt.getFullYear();
  const last = await db.labResult.findFirst({
    where: { reference: { startsWith: `LAB-${year}-` } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const nextNum = last ? parseInt(last.reference.split("-")[2], 10) + 1 : 1000;
  const reference = `LAB-${year}-${nextNum}`;

  const result = await db.labResult.create({
    data: {
      reference,
      patientDbId: patient.id,
      category: data.category,
      testName: data.testName,
      specimen: data.specimen ?? null,
      orderingPhysician: data.orderingPhysician ?? null,
      status: data.status,
      collectedAt,
      reportedAt:
        data.status === "PENDING" ? null : data.reportedAt ? new Date(data.reportedAt) : new Date(),
      notes: data.notes ?? null,
      values: data.values.length
        ? {
            create: data.values.map((v, i) => ({
              analyte: v.analyte,
              value: v.value,
              unit: v.unit ?? null,
              refRange: v.refRange ?? null,
              flag: v.flag,
              sortOrder: i,
            })),
          }
        : undefined,
    },
  });

  await audit("SYSTEM", "integration", "RESULT_CREATED", reference, `patient=${patient.patientId}`);
  return NextResponse.json(
    { reference: result.reference, patientId: patient.patientId, status: result.status },
    { status: 201 },
  );
}
