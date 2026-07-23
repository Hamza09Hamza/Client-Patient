import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import { looksLikePdf, storeReportPdf, MAX_REPORT_BYTES, MAX_REPORTS_PER_BATCH } from "@/lib/report-storage";
import { createShareGrant } from "@/lib/report-share";

/**
 * Shared core behind both report-ingestion endpoints — see docs/API.md:
 *   POST /api/integration/reports      (generateQr: true)  — current deliveries: mints a QR
 *                                                             per stored report, for the
 *                                                             patient to scan (no login)
 *   POST /api/integration/sync/reports (generateQr: false) — historical/bulk import, never
 *                                                             mints a QR
 * Neither endpoint returns patient credentials — passwords are hashed at rest (see
 * src/lib/password.ts) and are only ever handed back once, by
 * POST /api/integration/patients at generation/regeneration time.
 * Same multipart batch shape either way: a "metadata" JSON array plus one
 * `file:{externalId}` part per item.
 */

const itemSchema = z.object({
  patientId: z
    .string()
    .trim()
    .min(3)
    .max(60)
    .regex(/^[A-Za-z0-9-]+$/, "patientId may only contain letters, numbers, and dashes"),
  externalId: z.string().trim().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  category: z.string().trim().max(80).optional(),
  collectedAt: z.string().trim().min(1),
  physician: z.string().trim().max(120).optional(),
  specimen: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
});

const batchSchema = z.array(itemSchema).min(1).max(MAX_REPORTS_PER_BATCH);

interface ItemResult {
  externalId: string;
  patientId: string;
  status: "stored" | "error";
  error?: string;
  qrGenerated: boolean;
  qr?: { publicId: string; url: string; svg: string; expiresAt: string };
}

function resolveOrigin(request: NextRequest): string {
  return process.env.PUBLIC_BASE_URL?.replace(/\/$/, "") || request.nextUrl.origin;
}

export interface ReportPushOptions {
  /** Which env var holds the bearer key for this endpoint — separate scopes for delivery vs. sync. */
  authEnvVar: string;
  /** Delivery mints a QR share grant per stored report; sync never does. */
  generateQr: boolean;
  /** Audit actor id and action label for this call. */
  actorId: string;
  auditAction: string;
}

export async function handleReportPush(request: NextRequest, options: ReportPushOptions): Promise<NextResponse> {
  const denied = checkIntegrationAuth(request, options.authEnvVar);
  if (denied) return denied;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Body must be multipart/form-data." }, { status: 400 });
  }

  const rawMetadata = form.get("metadata");
  if (typeof rawMetadata !== "string") {
    return NextResponse.json({ error: 'Missing "metadata" field (JSON array).' }, { status: 400 });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawMetadata);
  } catch {
    return NextResponse.json({ error: '"metadata" is not valid JSON.' }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: `Invalid metadata (batches are limited to ${MAX_REPORTS_PER_BATCH} reports — split a larger backfill across multiple calls).`,
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  const origin = resolveOrigin(request);
  const results: ItemResult[] = [];

  for (const item of parsed.data) {
    const base = { externalId: item.externalId, patientId: item.patientId, qrGenerated: options.generateQr };

    const collectedAt = new Date(item.collectedAt);
    if (Number.isNaN(collectedAt.getTime())) {
      results.push({ ...base, status: "error", error: "Invalid collectedAt." });
      continue;
    }

    const file = form.get(`file:${item.externalId}`);
    if (!(file instanceof File)) {
      results.push({ ...base, status: "error", error: `Missing file part "file:${item.externalId}".` });
      continue;
    }
    if (file.size > MAX_REPORT_BYTES) {
      results.push({ ...base, status: "error", error: `PDF exceeds ${MAX_REPORT_BYTES / (1024 * 1024)}MB.` });
      continue;
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikePdf(bytes)) {
      results.push({ ...base, status: "error", error: "File is not a PDF." });
      continue;
    }

    const patient = await db.patient.findUnique({ where: { patientId: item.patientId } });
    if (!patient) {
      results.push({
        ...base,
        status: "error",
        error: "Unknown patientId — provision the patient via /api/integration/patients first.",
      });
      continue;
    }

    const pdfPath = await storeReportPdf(bytes);

    const labResult = await db.labResult.upsert({
      where: { patientDbId_sourceRef: { patientDbId: patient.id, sourceRef: item.externalId } },
      create: {
        reference: `SRC-${item.externalId}`,
        patientDbId: patient.id,
        category: item.category ?? "Clinic report",
        testName: item.title,
        status: "COMPLETED",
        orderingPhysician: item.physician ?? null,
        specimen: item.specimen ?? null,
        collectedAt,
        reportedAt: collectedAt,
        notes: item.notes ?? null,
        sourceRef: item.externalId,
        pdfPath,
      },
      update: {
        testName: item.title,
        category: item.category ?? "Clinic report",
        orderingPhysician: item.physician ?? null,
        specimen: item.specimen ?? null,
        collectedAt,
        notes: item.notes ?? null,
        pdfPath,
      },
    });

    let qr: ItemResult["qr"];
    if (options.generateQr) {
      const grant = await createShareGrant(labResult.id);
      const url = `${origin}/r/${grant.publicId}#t=${grant.token}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1 });
      qr = { publicId: grant.publicId, url, svg, expiresAt: grant.expiresAt.toISOString() };
    }

    results.push({ ...base, status: "stored", qr });
  }

  const storedCount = results.filter((r) => r.status === "stored").length;
  await audit(
    "SYSTEM",
    options.actorId,
    options.auditAction,
    undefined,
    `stored=${storedCount} failed=${results.length - storedCount}`,
  );

  return NextResponse.json({ results });
}
