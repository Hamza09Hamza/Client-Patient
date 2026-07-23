import type { NextRequest } from "next/server";
import { handleReportPush } from "@/lib/report-push";

/**
 * Push endpoint for freshly generated reports from the clinic's own system
 * (SERVER A): it sends us the actual PDF bytes, we store them locally and
 * mint a QR share grant per report — see docs/API.md. For historical/bulk
 * backfills that shouldn't mint QR codes, use /api/integration/sync/reports
 * instead.
 */
export async function POST(request: NextRequest) {
  return handleReportPush(request, {
    authEnvVar: "INTEGRATION_API_KEY",
    generateQr: true,
    actorId: "integration",
    auditAction: "REPORTS_PUSHED",
  });
}
