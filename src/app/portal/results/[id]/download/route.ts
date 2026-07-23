import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { readReportPdf } from "@/lib/report-storage";

// Serves the report PDF as an attachment, logging the download first — the
// only place a "download" actually happens (see ../file/route.ts for the
// untracked inline-view route PdfViewer renders from).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePatient();
  const { id } = await params;

  const result = await db.labResult.findFirst({
    where: { id, patientDbId: session.sub },
    select: { reference: true, pdfPath: true },
  });
  if (!result?.pdfPath) {
    return NextResponse.json({ error: "Report not available." }, { status: 404 });
  }

  let bytes: Buffer;
  try {
    bytes = await readReportPdf(result.pdfPath);
  } catch {
    return NextResponse.json({ error: "Report file missing." }, { status: 404 });
  }

  await audit("PATIENT", session.username, "RESULT_DOWNLOADED", result.reference);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
