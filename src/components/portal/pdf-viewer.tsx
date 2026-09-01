import { ArrowUpRight, Download, FileText } from "lucide-react";

interface PdfViewerProps {
  src: string;
  /** Tracked download endpoint (audit-logs the download, then redirects to `src`). */
  downloadHref: string;
  title: string;
  openLabel: string;
  downloadLabel: string;
}

/**
 * No inline preview of any kind — deliberately. Embedding a PDF (iframe or
 * otherwise) only works if the browser rendering it has its own PDF viewer
 * wired up, and plenty of real-world contexts don't: an in-app webview
 * inside a chat app or QR-scanner app routinely has none, and just renders
 * blank when asked to embed one. A direct link opened as a real top-level
 * navigation is the one thing that degrades gracefully everywhere — a real
 * browser shows or downloads the PDF; a restricted webview at least gets a
 * full navigation to work with instead of a silently empty frame.
 */
export function PdfViewer({ src, downloadHref, title, openLabel, downloadLabel }: PdfViewerProps) {
  return (
    <div className="px-4 pb-4 sm:px-6">
      <div className="no-print flex flex-col items-center gap-4 rounded-2xl border border-border bg-canvas py-12 text-center">
        <FileText aria-hidden className="size-10 text-ink-faint" />
        <p className="max-w-xs text-sm font-medium text-ink-muted">{title}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-white shadow-sm transition-colors duration-150 hover:bg-primary-strong"
          >
            {openLabel}
            <ArrowUpRight aria-hidden className="size-4" />
          </a>
          <a
            href={downloadHref}
            download
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border-strong px-4 text-sm font-medium text-primary-deep transition-colors duration-150 hover:bg-primary-wash"
          >
            {downloadLabel}
            <Download aria-hidden className="size-4" />
          </a>
        </div>
      </div>
      <p className="hidden text-[12px] print:block">{src}</p>
    </div>
  );
}
