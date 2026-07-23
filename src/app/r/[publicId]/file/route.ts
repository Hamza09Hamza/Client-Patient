import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyShareSession, SHARE_COOKIE } from "@/lib/report-share";
import { readReportPdf } from "@/lib/report-storage";

// Serves the PDF for a QR-shared report. Re-checks the grant in the database
// on every request (not just the signed cookie) so a revocation takes effect
// immediately instead of waiting out the session's remaining lifetime.
export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;

  const grant = await db.reportShareGrant.findUnique({
    where: { publicId },
    select: { labResultId: true, revokedAt: true, expiresAt: true },
  });
  if (!grant || grant.revokedAt || grant.expiresAt < new Date()) {
    return NextResponse.json({ error: "This link is invalid, expired, or has been revoked." }, { status: 404 });
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SHARE_COOKIE)?.value;
  const verifiedLabResultId = sessionToken ? await verifyShareSession(sessionToken, publicId) : null;
  if (!verifiedLabResultId || verifiedLabResultId !== grant.labResultId) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }

  const result = await db.labResult.findUnique({
    where: { id: grant.labResultId },
    select: { pdfPath: true },
  });
  if (!result?.pdfPath) {
    return NextResponse.json({ error: "Report not available." }, { status: 404 });
  }

  try {
    const bytes = await readReportPdf(result.pdfPath);
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Report file missing." }, { status: 404 });
  }
}
