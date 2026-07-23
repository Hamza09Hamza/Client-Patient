import type { NextRequest } from "next/server";
import { handleReportPush } from "@/lib/report-push";

/**
 * Historical/bulk import endpoint — same batch contract as
 * /api/integration/reports, but never mints a QR share grant (a fresh
 * physical QR for an old, already-reviewed report has no purpose) and uses
 * its own credential so a compromised sync key can't be used to push
 * QR-bearing "current" deliveries. See docs/API.md.
 */
export async function POST(request: NextRequest) {
  return handleReportPush(request, {
    authEnvVar: "INTEGRATION_SYNC_API_KEY",
    generateQr: false,
    actorId: "integration-sync",
    auditAction: "REPORTS_SYNCED",
  });
}
