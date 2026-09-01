import { ArrowUpRight, Download } from "lucide-react";

interface PdfViewerProps {
  src: string;
  /** Tracked download endpoint (audit-logs the download, then redirects to `src`). */
  downloadHref: string;
  title: string;
  openLabel: string;
  downloadLabel: string;
}

/**
 * Deliberately just an iframe onto the browser's own PDF viewer — no custom
 * canvas rendering, no pdfjs, no toolbar. Every device renders PDFs
 * differently; the browser's native handling is the one thing guaranteed to
 * already be tested against real-world PDFs, unlike anything we'd build.
 */
export function PdfViewer({ src, downloadHref, title, openLabel, downloadLabel }: PdfViewerProps) {
  return (
    <div className="px-4 pb-4 sm:px-6">
      <div className="no-print mb-2 flex items-center justify-end gap-1.5">
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-strong px-2.5 text-[12px] font-medium text-primary-deep transition-colors duration-150 hover:bg-primary-wash"
        >
          {openLabel}
          <ArrowUpRight aria-hidden className="size-3.5" />
        </a>
        <a
          href={downloadHref}
          download
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-[12px] font-medium text-white shadow-sm transition-colors duration-150 hover:bg-primary-strong"
        >
          {downloadLabel}
          <Download aria-hidden className="size-3.5" />
        </a>
      </div>
      <div className="no-print overflow-hidden rounded-2xl border border-border bg-canvas">
        <iframe src={src} title={title} className="h-[72vh] w-full" />
      </div>
      <p className="hidden text-[12px] print:block">{src}</p>
    </div>
  );
}
