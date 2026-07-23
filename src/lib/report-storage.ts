import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

/**
 * Local disk storage for report PDFs pushed from the clinic's own system —
 * see src/app/api/integration/reports/route.ts. Files live outside
 * `public/`, under `uploads/`, so they're only reachable through the
 * authenticated portal routes, same pattern as PasswordResetRequest's
 * idPhotoPath.
 */

export const REPORTS_DIR = join(process.cwd(), "uploads", "reports");

export const MAX_REPORT_BYTES = 25 * 1024 * 1024; // 25MB per PDF
export const MAX_REPORTS_PER_BATCH = 60; // push a large backfill across several calls instead

export function looksLikePdf(bytes: Buffer): boolean {
  return bytes.length > 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** Writes a validated PDF buffer to disk and returns its stored filename (for `LabResult.pdfPath`). */
export async function storeReportPdf(bytes: Buffer): Promise<string> {
  await mkdir(REPORTS_DIR, { recursive: true });
  const filename = `${randomUUID()}.pdf`;
  await writeFile(join(REPORTS_DIR, filename), bytes);
  return filename;
}

/** Reads a previously stored report PDF back off disk. `pdfPath` always comes from our own DB column, never user input. */
export async function readReportPdf(pdfPath: string): Promise<Buffer> {
  return readFile(join(REPORTS_DIR, pdfPath));
}
