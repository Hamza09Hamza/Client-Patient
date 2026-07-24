import QRCode from "qrcode";
import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { checkIntegrationAuth } from "@/lib/integration-auth";
import {
  deleteReportPdf,
  looksLikePdf,
  readReportPdf,
  reportSha256,
  storeReportPdf,
  MAX_BATCH_BYTES,
  MAX_MULTIPART_BYTES,
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
  status: "stored" | "already_stored" | "conflict" | "error";
  error?: string;
  qrGenerated: boolean;
  qr?: { publicId: string; url: string; svg: string; expiresAt: string };
}

function resolveOrigin(request: NextRequest): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("PUBLIC_BASE_URL is required in production.");
    }
    return request.nextUrl.origin;
  }

  const url = new URL(configured);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new Error("PUBLIC_BASE_URL must use HTTPS in production.");
  }
  return url.origin;
}

interface ExistingReport {
  id: string;
  pdfPath: string | null;
  pdfSha256: string | null;
}

async function existingReportMatches(existing: ExistingReport, incomingSha256: string): Promise<boolean> {
  if (!existing.pdfPath) {
    throw new Error("Existing integrated report has no stored PDF.");
  }

  const storedSha256 = reportSha256(await readReportPdf(existing.pdfPath));
  if (existing.pdfSha256 && existing.pdfSha256 !== storedSha256) {
    throw new Error("Existing report PDF does not match its stored fingerprint.");
  }
  if (!existing.pdfSha256) {
    await db.labResult.updateMany({
      where: { id: existing.id, pdfSha256: null },
      data: { pdfSha256: storedSha256 },
    });
  }
  return storedSha256 === incomingSha256;
}

function isConcurrentReportCreate(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }
  const target = Array.isArray(error.meta?.target) ? error.meta.target : [];
  return target.includes("patientDbId") && target.includes("sourceRef");
}

async function mintQr(labResultId: string, origin: string): Promise<NonNullable<ItemResult["qr"]>> {
  const grant = await createShareGrant(labResultId);
  try {
    const url = `${origin}/r/${grant.publicId}#t=${grant.token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1 });
    return { publicId: grant.publicId, url, svg, expiresAt: grant.expiresAt.toISOString() };
  } catch (error) {
    await db.reportShareGrant.deleteMany({ where: { publicId: grant.publicId } }).catch(() => {});
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const denied = checkIntegrationAuth(request);
  if (denied) return denied;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MULTIPART_BYTES) {
    return NextResponse.json(
      { error: `Multipart request exceeds the ${MAX_MULTIPART_BYTES / (1024 * 1024)}MB request limit.` },
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

  let origin: string;
  try {
    origin = resolveOrigin(request);
  } catch {
    return NextResponse.json(
      { error: "Server B is missing a valid production PUBLIC_BASE_URL." },
      { status: 503 },
    );
  }
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
    const incomingSha256 = reportSha256(bytes);

    let pdfPath: string | null = null;
    let reportStored = false;
    let qrAttempted = false;

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
        select: { id: true, pdfPath: true, pdfSha256: true },
      });

      if (existing) {
        reportStored = true;
        if (!(await existingReportMatches(existing, incomingSha256))) {
          results.push({
            ...base,
            status: "conflict",
            error: "This externalId already belongs to a different PDF. Send the new report with a new externalId.",
          });
          continue;
        }

        qrAttempted = true;
        const qr = await mintQr(existing.id, origin);
        results.push({ ...base, status: "already_stored", qrGenerated: true, qr });
        continue;
      }

      pdfPath = await storeReportPdf(bytes);
      let labResult: { id: string };
      try {
        labResult = await db.labResult.create({
          data: {
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
            pdfSha256: incomingSha256,
          },
          select: { id: true },
        });
      } catch (error) {
        if (!isConcurrentReportCreate(error)) throw error;

        await deleteReportPdf(pdfPath);
        pdfPath = null;
        const racedReport = await db.labResult.findUnique({
          where: { patientDbId_sourceRef: { patientDbId: patient.id, sourceRef: item.externalId } },
          select: { id: true, pdfPath: true, pdfSha256: true },
        });
        if (!racedReport) throw error;

        reportStored = true;
        if (!(await existingReportMatches(racedReport, incomingSha256))) {
          results.push({
            ...base,
            status: "conflict",
            error: "This externalId was concurrently stored with a different PDF. Use a new externalId.",
          });
          continue;
        }
        qrAttempted = true;
        const qr = await mintQr(racedReport.id, origin);
        results.push({ ...base, status: "already_stored", qrGenerated: true, qr });
        continue;
      }

      reportStored = true;
      qrAttempted = true;
      const qr = await mintQr(labResult.id, origin);
      results.push({ ...base, status: "stored", qrGenerated: true, qr });
    } catch (error) {
      // A file not referenced by a successfully created database row is an
      // orphan, so remove it before reporting the item failure.
      if (pdfPath && !reportStored) {
        try {
          await deleteReportPdf(pdfPath);
        } catch {
          // The audit summary below still records this item as failed.
        }
      }
      console.error("report ingestion failed", {
        externalId: item.externalId,
        patientId: item.patientId,
        error,
      });
      results.push({
        ...base,
        status: "error",
        error: reportStored && qrAttempted
          ? "Report stored, but QR generation failed. Retry this externalId."
          : reportStored
            ? "Existing report could not be verified. Server B storage requires attention."
            : "Report could not be stored. Retry this externalId.",
      });
    }
  }

  const storedCount = results.filter((r) => r.status === "stored").length;
  const alreadyStoredCount = results.filter((r) => r.status === "already_stored").length;
  const conflictCount = results.filter((r) => r.status === "conflict").length;
  await audit(
    "SYSTEM",
    "integration",
    "REPORTS_PUSHED",
    undefined,
    `stored=${storedCount} alreadyStored=${alreadyStoredCount} conflicts=${conflictCount} errors=${
      results.length - storedCount - alreadyStoredCount - conflictCount
    }`,
  );

  return NextResponse.json({ results });
}
