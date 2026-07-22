import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { formatDate, formatDateTime } from "@/lib/format";
import { CLINIC_NAME } from "@/lib/config";

const TEAL = rgb(8 / 255, 145 / 255, 178 / 255);
const TEAL_DEEP = rgb(21 / 255, 94 / 255, 117 / 255);
const INK = rgb(16 / 255, 51 / 255, 58 / 255);
const MUTED = rgb(77 / 255, 107 / 255, 114 / 255);
const LINE = rgb(221 / 255, 233 / 255, 235 / 255);
const RED = rgb(220 / 255, 38 / 255, 38 / 255);
const AMBER = rgb(180 / 255, 83 / 255, 9 / 255);
const BLUE = rgb(37 / 255, 99 / 255, 235 / 255);
const GREEN = rgb(21 / 255, 128 / 255, 61 / 255);

const PAGE_W = 595.28; // A4
const PAGE_H = 841.89;
const MARGIN = 48;

// Standard PDF fonts use WinAnsi encoding — swap characters it cannot represent.
const CHAR_MAP: Record<string, string> = {
  "⁰": "^0", "¹": "^1", "²": "^2", "³": "^3", "⁴": "^4",
  "⁵": "^5", "⁶": "^6", "⁷": "^7", "⁸": "^8", "⁹": "^9",
};
const SAFE_HIGH = new Set(["–", "—", "‘", "’", "“", "”", "•", "…", "€", "™"]);

function pdfSafe(text: string): string {
  return Array.from(text)
    .map((c) => CHAR_MAP[c] ?? (c.charCodeAt(0) <= 0xff || SAFE_HIGH.has(c) ? c : "?"))
    .join("");
}

const FLAG_STYLE = {
  NORMAL: { label: "Normal", color: GREEN },
  LOW: { label: "Low", color: BLUE },
  HIGH: { label: "High", color: AMBER },
  CRITICAL: { label: "CRITICAL", color: RED },
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (session?.role !== "patient") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const result = await db.labResult.findFirst({
    where: { id, patientDbId: session.sub },
    include: {
      values: { orderBy: { sortOrder: "asc" } },
      patient: { select: { fullName: true, patientId: true, dateOfBirth: true, gender: true } },
    },
  });
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (
    p: PDFPage,
    str: string,
    x: number,
    yPos: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => p.drawText(pdfSafe(str), { x, y: yPos, size, font: f, color });

  const rightText = (
    p: PDFPage,
    str: string,
    rightEdge: number,
    yPos: number,
    size: number,
    f: PDFFont,
    color = INK,
  ) => {
    const w = f.widthOfTextAtSize(pdfSafe(str), size);
    p.drawText(pdfSafe(str), { x: rightEdge - w, y: yPos, size, font: f, color });
  };

  // ---- Header band
  page.drawRectangle({ x: 0, y: PAGE_H - 110, width: PAGE_W, height: 110, color: TEAL_DEEP });
  text(page, CLINIC_NAME, MARGIN, PAGE_H - 52, 22, bold, rgb(1, 1, 1));
  text(page, "Laboratory Report", MARGIN, PAGE_H - 72, 12, font, rgb(0.8, 0.95, 1));
  rightText(page, result.reference, PAGE_W - MARGIN, PAGE_H - 52, 13, bold, rgb(1, 1, 1));
  rightText(
    page,
    `Issued ${formatDate(result.reportedAt ?? result.collectedAt)}`,
    PAGE_W - MARGIN,
    PAGE_H - 70,
    10,
    font,
    rgb(0.8, 0.95, 1),
  );

  y = PAGE_H - 140;

  // ---- Patient / order block
  const blockLine = (label: string, value: string, x: number) => {
    text(page, label.toUpperCase(), x, y, 7.5, bold, MUTED);
    text(page, value, x, y - 14, 10.5, bold, INK);
  };
  blockLine("Patient", result.patient.fullName, MARGIN);
  blockLine("Patient ID", result.patient.patientId, MARGIN + 190);
  blockLine(
    "Date of birth",
    result.patient.dateOfBirth ? formatDate(result.patient.dateOfBirth) : "—",
    MARGIN + 330,
  );
  y -= 44;
  blockLine("Examination", result.testName, MARGIN);
  blockLine("Category", result.category, MARGIN + 190);
  blockLine("Specimen", result.specimen ?? "—", MARGIN + 330);
  y -= 44;
  blockLine("Collected", formatDateTime(result.collectedAt), MARGIN);
  blockLine(
    "Reported",
    result.reportedAt ? formatDateTime(result.reportedAt) : "In progress",
    MARGIN + 190,
  );
  blockLine("Physician", result.orderingPhysician ?? "—", MARGIN + 330);
  y -= 34;

  page.drawLine({
    start: { x: MARGIN, y },
    end: { x: PAGE_W - MARGIN, y },
    thickness: 1,
    color: LINE,
  });
  y -= 26;

  // ---- Results table
  const COL_ANALYTE = MARGIN;
  const COL_RESULT_R = MARGIN + 300;
  const COL_RANGE_R = MARGIN + 420;
  const COL_FLAG_R = PAGE_W - MARGIN;

  const tableHeader = () => {
    text(page, "ANALYTE", COL_ANALYTE, y, 8, bold, TEAL);
    rightText(page, "RESULT", COL_RESULT_R, y, 8, bold, TEAL);
    rightText(page, "REFERENCE RANGE", COL_RANGE_R, y, 8, bold, TEAL);
    rightText(page, "FLAG", COL_FLAG_R, y, 8, bold, TEAL);
    y -= 8;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1.2,
      color: TEAL,
    });
    y -= 18;
  };

  if (result.values.length > 0) {
    tableHeader();
    for (const v of result.values) {
      if (y < MARGIN + 90) {
        page = doc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN - 10;
        tableHeader();
      }
      const style = FLAG_STYLE[v.flag];
      text(page, v.analyte, COL_ANALYTE, y, 10.5, font, INK);
      rightText(page, `${v.value}${v.unit ? ` ${v.unit}` : ""}`, COL_RESULT_R, y, 10.5, bold, INK);
      rightText(
        page,
        v.refRange ? `${v.refRange}${v.unit ? ` ${v.unit}` : ""}` : "—",
        COL_RANGE_R,
        y,
        9.5,
        font,
        MUTED,
      );
      rightText(page, style.label, COL_FLAG_R, y, 9.5, bold, style.color);
      y -= 8;
      page.drawLine({
        start: { x: MARGIN, y },
        end: { x: PAGE_W - MARGIN, y },
        thickness: 0.5,
        color: LINE,
      });
      y -= 14;
    }
  } else {
    text(page, "This analysis is still in progress — no validated values yet.", MARGIN, y, 10.5, font, MUTED);
    y -= 24;
  }

  // ---- Notes
  if (result.notes) {
    y -= 10;
    text(page, "LABORATORY NOTES", MARGIN, y, 8, bold, MUTED);
    y -= 15;
    text(page, result.notes, MARGIN, y, 9.5, font, INK);
    y -= 20;
  }

  // ---- Footer
  const footerY = MARGIN - 14;
  page.drawLine({
    start: { x: MARGIN, y: footerY + 22 },
    end: { x: PAGE_W - MARGIN, y: footerY + 22 },
    thickness: 0.5,
    color: LINE,
  });
  text(
    page,
    "Values outside the reference range are flagged for your physician's attention — they are not a diagnosis on their own.",
    MARGIN,
    footerY + 8,
    7.5,
    font,
    MUTED,
  );
  text(
    page,
    `Generated for ${result.patient.fullName} on ${formatDateTime(new Date())} - ${CLINIC_NAME} Laboratory Portal`,
    MARGIN,
    footerY - 4,
    7.5,
    font,
    MUTED,
  );

  const bytes = await doc.save();
  await audit("PATIENT", session.username, "RESULT_DOWNLOADED", result.reference);

  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${result.reference}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
