import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import {
  deleteReportPdf,
  looksLikePdf,
  storeReportPdf,
  MAX_BATCH_BYTES,
  MAX_REPORT_BYTES,
  MAX_REPORTS_PER_BATCH,
} from "@/lib/report-storage";
import { createShareGrant } from "@/lib/report-share";

/**
 * Push endpoint for reports from the clinic's own system (SERVER A): it sends
 * the actual PDF bytes, we store them locally and mint a QR share grant per
 * report — see docs/API.md. Never returns patient credentials — passwords are
 * hashed at rest (see src/lib/password.ts) and are only ever handed back
 * once, by POST /api/integration/patients when a patient is first created.
 * Batch shape: a "metadata" JSON array plus one `file:{externalId}` part per
 * item.
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

const batchSchema = z
  .array(itemSchema)
  .min(1)
  .max(MAX_REPORTS_PER_BATCH)
  .superRefine((items, context) => {
    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.externalId)) {
        context.addIssue({
          code: "custom",
          path: [index, "externalId"],
          message: `Duplicate externalId "${item.externalId}" in this batch.`,
        });
      }
      ids.add(item.externalId);
    }
  });

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

export async function POST(request: NextRequest) {
  const denied = checkIntegrationAuth(request);
  if (denied) return denied;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BATCH_BYTES) {
    return NextResponse.json(
      { error: `Request exceeds the ${MAX_BATCH_BYTES / (1024 * 1024)}MB batch limit.` },
      { status: 413 },
    );
  }

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
        error: `Invalid metadata (batches are limited to ${MAX_REPORTS_PER_BATCH} reports — split a larger push across multiple calls).`,
        issues: parsed.error.issues.map((i) => i.message),
      },
      { status: 422 },
    );
  }

  let batchBytes = 0;
  for (const item of parsed.data) {
    const file = form.get(`file:${item.externalId}`);
    if (file instanceof File) batchBytes += file.size;
  }
  if (batchBytes > MAX_BATCH_BYTES) {
    return NextResponse.json(
      { error: `PDF files exceed the ${MAX_BATCH_BYTES / (1024 * 1024)}MB batch limit.` },
      { status: 413 },
    );
  }

  const origin = resolveOrigin(request);
  const results: ItemResult[] = [];

  for (const item of parsed.data) {
    const base = { externalId: item.externalId, patientId: item.patientId, qrGenerated: false };

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

    let bytes: Buffer;
    try {
      bytes = Buffer.from(await file.arrayBuffer());
    } catch {
      results.push({ ...base, status: "error", error: "PDF could not be read. Retry this externalId." });
      continue;
    }
    if (!looksLikePdf(bytes)) {
      results.push({ ...base, status: "error", error: "File is not a PDF." });
      continue;
    }

    let pdfPath: string | null = null;
    let databaseUpdated = false;
    let grantPublicId: string | null = null;

    try {
      const patient = await db.patient.findUnique({ where: { patientId: item.patientId } });
      if (!patient) {
        results.push({
          ...base,
          status: "error",
          error: "Unknown patientId — provision the patient via /api/integration/patients first.",
        });
        continue;
      }

      const existing = await db.labResult.findUnique({
        where: { patientDbId_sourceRef: { patientDbId: patient.id, sourceRef: item.externalId } },
        select: { pdfPath: true },
      });

      pdfPath = await storeReportPdf(bytes);
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
          reportedAt: collectedAt,
          notes: item.notes ?? null,
          pdfPath,
        },
      });
      databaseUpdated = true;

      // A resend replaces the database pointer. Remove the previous file only
      // after that succeeds, and only if no other report still references it
      // (the demo seed intentionally shares one sample PDF).
      if (existing?.pdfPath && existing.pdfPath !== pdfPath) {
        try {
          const remainingReferences = await db.labResult.count({
            where: { pdfPath: existing.pdfPath },
          });
          if (remainingReferences === 0) {
            await deleteReportPdf(existing.pdfPath);
          }
        } catch {
          await audit("SYSTEM", "integration", "REPORT_FILE_CLEANUP_FAILED", item.externalId);
        }
      }

      const grant = await createShareGrant(labResult.id);
      grantPublicId = grant.publicId;
      const url = `${origin}/r/${grant.publicId}#t=${grant.token}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1 });
      const qr = { publicId: grant.publicId, url, svg, expiresAt: grant.expiresAt.toISOString() };

      results.push({ ...base, status: "stored", qrGenerated: true, qr });
    } catch (error) {
      // Before the DB points at the new file it is safe to remove it. After a
      // successful upsert the portal already references it, so keep it and
      // tell Server A to retry the same externalId if QR creation failed.
      if (pdfPath && !databaseUpdated) {
        try {
          await deleteReportPdf(pdfPath);
        } catch {
          // The audit summary below still records this item as failed.
        }
      }
      if (grantPublicId) {
        await db.reportShareGrant.deleteMany({ where: { publicId: grantPublicId } }).catch(() => {});
      }
      console.error("report ingestion failed", {
        externalId: item.externalId,
        patientId: item.patientId,
        error,
      });
      results.push({
        ...base,
        status: "error",
        error: databaseUpdated
          ? "Report stored, but QR generation failed. Retry this externalId."
          : "Report could not be stored. Retry this externalId.",
      });
    }
  }

  const storedCount = results.filter((r) => r.status === "stored").length;
  await audit(
    "SYSTEM",
    "integration",
    "REPORTS_PUSHED",
    undefined,
    `stored=${storedCount} failed=${results.length - storedCount}`,
  );

  return NextResponse.json({ results });
}
