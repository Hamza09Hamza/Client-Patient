import { NextResponse } from "next/server";
import { requirePatient } from "@/lib/dal";
import { db } from "@/lib/db";
import { readReportPdf } from "@/lib/report-storage";

// Serves the raw PDF bytes for inline viewing (what PdfViewer's pdfjs
// instance fetches, and what "Open in new tab" points at). Not audited as a
// download — the result-detail page already logs RESULT_VIEWED once when
// opened; see ./download/route.ts for the explicit, tracked download.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requirePatient();
  const { id } = await params;

  const result = await db.labResult.findFirst({
    where: { id, patientDbId: session.sub },
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
