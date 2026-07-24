import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { basename, join } from "path";

/**
 * Local disk storage for report PDFs pushed from the clinic's own system —
 * see src/app/api/integration/reports/route.ts. Files live outside
 * `public/`, under `uploads/`, so they're only reachable through the
 * authenticated portal routes.
 */

export const REPORTS_DIR = join(process.cwd(), "uploads", "reports");

export const MAX_REPORT_BYTES = 25 * 1024 * 1024; // 25MB per PDF
export const MAX_REPORTS_PER_BATCH = 10; // comfortably covers the clinic's normal 5–7 report bursts
export const MAX_BATCH_BYTES = 100 * 1024 * 1024; // combined PDF bytes
export const MAX_MULTIPART_BYTES = 105 * 1024 * 1024; // PDFs plus multipart metadata/headers

function reportPath(filename: string): string {
  if (
    basename(filename) !== filename ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,199}\.pdf$/.test(filename)
  ) {
    throw new Error("Invalid stored report filename.");
  }
  return join(REPORTS_DIR, filename);
}

export function looksLikePdf(bytes: Buffer): boolean {
  return bytes.length > 5 && bytes.subarray(0, 5).toString("latin1") === "%PDF-";
}

export function reportSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Writes a validated PDF buffer to disk and returns its stored filename (for `LabResult.pdfPath`). */
export async function storeReportPdf(bytes: Buffer): Promise<string> {
  await mkdir(REPORTS_DIR, { recursive: true, mode: 0o700 });
  const filename = `${randomUUID()}.pdf`;
  await writeFile(reportPath(filename), bytes, { mode: 0o600, flag: "wx" });
  return filename;
}

/** Reads a previously stored report PDF back off disk. `pdfPath` always comes from our own DB column, never user input. */
export async function readReportPdf(pdfPath: string): Promise<Buffer> {
  return readFile(reportPath(pdfPath));
}

/** Removes an internally generated stored filename. Missing files are already clean. */
export async function deleteReportPdf(pdfPath: string): Promise<void> {
  try {
    await unlink(reportPath(pdfPath));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
