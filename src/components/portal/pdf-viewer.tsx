"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import type { PDFDocumentLoadingTask, PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  PanelLeft,
  StretchHorizontal,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { t } from "@/lib/i18n/dictionaries";

const MIN_SCALE = 0.4;
const MAX_SCALE = 3.5;
const ZOOM_STEP = 0.18;
const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

interface PdfViewerProps {
  src: string;
  /** Tracked download endpoint (audit-logs the download, then redirects to `src`). */
  downloadHref: string;
  title: string;
  dict: Dictionary["pdfViewer"];
  openLabel: string;
  downloadLabel: string;
}

export function PdfViewer({ src, downloadHref, title, dict, openLabel, downloadLabel }: PdfViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "fallback">("loading");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [scale, setScale] = useState(1);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [pageInput, setPageInput] = useState("1");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  // Keep the page-number input in sync with pageNum (e.g. after prev/next or
  // a thumbnail click) without fighting the user's own in-progress typing —
  // adjusted during render rather than in an effect, per React's guidance for
  // state that mirrors another value: https://react.dev/learn/you-might-not-need-an-effect
  const [syncedPageNum, setSyncedPageNum] = useState(pageNum);
  if (pageNum !== syncedPageNum) {
    setSyncedPageNum(pageNum);
    setPageInput(String(pageNum));
  }

  // Load the document (client-only import — pdfjs touches window/Worker).
  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;

    (async () => {
      setStatus("loading");
      setPdf(null);
      setNumPages(0);
      setPageNum(1);
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        loadingTask = pdfjsLib.getDocument({ url: src });
        const doc = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy();
          return;
        }
        setPdf(doc);
        setNumPages(doc.numPages);
        setStatus("ready");
      } catch {
        // Most commonly a cross-origin PDF host without CORS headers, which
        // blocks pdfjs from fetching bytes — the browser's own viewer in an
        // iframe doesn't need CORS, so it still works as a fallback.
        if (!cancelled) setStatus("fallback");
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [src]);

  // Fit-to-width sizing, recomputed on container resize while active.
  useEffect(() => {
    if (!pdf || status !== "ready") return;
    const stage = stageRef.current;
    if (!stage) return;

    let cancelled = false;
    async function computeFit() {
      if (!fitToWidth || !pdf) return;
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const unscaledWidth = page.getViewport({ scale: 1 }).width;
      const available = stage!.clientWidth - 48;
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, available / unscaledWidth));
      setScale(next);
    }
    computeFit();

    const observer = new ResizeObserver(() => {
      if (fitToWidth) computeFit();
    });
    observer.observe(stage);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [pdf, status, pageNum, fitToWidth]);

  // Render the current page to the canvas whenever page/scale changes.
  useEffect(() => {
    if (!pdf || status !== "ready") return;
    let cancelled = false;

    (async () => {
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${viewport.width / dpr}px`;
      canvas.style.height = `${viewport.height / dpr}px`;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        // A cancelled render is expected when the user flips pages/zooms fast.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdf, status, pageNum, scale]);

  useEffect(() => {
    function onChange() {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const goToPage = useCallback(
    (next: number) => {
      setPageNum((current) => {
        const clamped = Math.min(Math.max(next, 1), Math.max(numPages, 1));
        return clamped === current ? current : clamped;
      });
    },
    [numPages],
  );

  const zoom = useCallback((delta: number) => {
    setFitToWidth(false);
    setScale((current) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, current + delta)));
  }, []);

  const handlePageInputCommit = useCallback(() => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) goToPage(parsed);
    else setPageInput(String(pageNum));
  }, [pageInput, pageNum, goToPage]);

  const handleStageKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement).tagName === "INPUT") return;
      if (event.key === "ArrowRight") goToPage(pageNum + 1);
      else if (event.key === "ArrowLeft") goToPage(pageNum - 1);
      else if (event.key === "+" || event.key === "=") zoom(ZOOM_STEP);
      else if (event.key === "-") zoom(-ZOOM_STEP);
    },
    [pageNum, goToPage, zoom],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    }
  }, []);

  if (status === "fallback") {
    return (
      <div className="px-4 pb-4 sm:px-6">
        <div className="no-print mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[12px] font-medium text-warn">{dict.fallbackNotice}</p>
          <div className="flex items-center gap-1.5">
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
        </div>
        <div className="no-print overflow-hidden rounded-2xl border border-border bg-canvas">
          <iframe src={src} title={title} className="h-[72vh] w-full" />
        </div>
        <p className="hidden text-[12px] print:block">{src}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bg-[#0d1a1e] px-4 pb-4 pt-3 sm:px-6">
      <div className="toolbar-panel no-print mb-3 flex flex-wrap items-center gap-1 rounded-2xl px-2 py-1.5">
        <div className="flex items-center gap-0.5">
          <ToolbarButton label={dict.previousPage} onClick={() => goToPage(pageNum - 1)} disabled={pageNum <= 1}>
            <ChevronLeft aria-hidden className="size-4" />
          </ToolbarButton>
          <div className="flex items-center gap-1 px-1 text-[12px] text-white/80">
            <input
              type="text"
              inputMode="numeric"
              aria-label={dict.goToPage}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              onBlur={handlePageInputCommit}
              onKeyDown={(e) => e.key === "Enter" && handlePageInputCommit()}
              className="tnum h-7 w-9 rounded-md border border-white/15 bg-white/10 text-center text-white outline-none focus-visible:border-white/40"
            />
            <span className="tnum whitespace-nowrap">/ {numPages || "…"}</span>
          </div>
          <ToolbarButton label={dict.nextPage} onClick={() => goToPage(pageNum + 1)} disabled={pageNum >= numPages}>
            <ChevronRight aria-hidden className="size-4" />
          </ToolbarButton>
        </div>

        <span aria-hidden className="mx-1 h-6 w-px bg-white/15" />

        <div className="flex items-center gap-0.5">
          <ToolbarButton label={dict.zoomOut} onClick={() => zoom(-ZOOM_STEP)} disabled={scale <= MIN_SCALE}>
            <ZoomOut aria-hidden className="size-4" />
          </ToolbarButton>
          <span className="tnum w-10 text-center text-[12px] text-white/80">{Math.round(scale * 100)}%</span>
          <ToolbarButton label={dict.zoomIn} onClick={() => zoom(ZOOM_STEP)} disabled={scale >= MAX_SCALE}>
            <ZoomIn aria-hidden className="size-4" />
          </ToolbarButton>
          <ToolbarButton label={dict.fitWidth} onClick={() => setFitToWidth(true)} active={fitToWidth}>
            <StretchHorizontal aria-hidden className="size-4" />
          </ToolbarButton>
        </div>

        <span aria-hidden className="mx-1 h-6 w-px bg-white/15" />

        <ToolbarButton label={dict.pages} onClick={() => setSidebarOpen((v) => !v)} active={sidebarOpen}>
          <PanelLeft aria-hidden className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label={isFullscreen ? dict.exitFullscreen : dict.fullscreen}
          onClick={toggleFullscreen}
          active={isFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 aria-hidden className="size-4" />
          ) : (
            <Maximize2 aria-hidden className="size-4" />
          )}
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-1.5">
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/15 px-2.5 text-[12px] font-medium text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white"
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
      </div>

      <div
        ref={stageRef}
        tabIndex={0}
        role="group"
        aria-label={title}
        onKeyDown={handleStageKeyDown}
        className="no-print flex overflow-auto overscroll-contain rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        style={{ height: "72vh" }}
      >
        {sidebarOpen && (
          <div
            data-thumb-rail
            className="hidden w-28 shrink-0 overflow-y-auto overscroll-contain border-r border-white/10 bg-black/20 p-2 sm:block"
          >
            {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <Thumbnail key={n} pdf={pdf} pageNumber={n} active={n === pageNum} onSelect={() => goToPage(n)} />
            ))}
          </div>
        )}
        <div className="flex flex-1 items-start justify-center p-6">
          {status === "loading" ? (
            <div className="flex flex-col items-center gap-2 self-center text-white/70">
              <Loader2 aria-hidden className="size-6 animate-spin" />
              <p className="text-[13px]">{dict.loading}</p>
            </div>
          ) : (
            <>
              <span className="sr-only">{dict.screenReaderHint}</span>
              <canvas ref={canvasRef} className="rounded-sm shadow-[0_8px_40px_rgb(0_0_0/0.45)]" />
            </>
          )}
        </div>
      </div>

      {numPages > 0 && (
        <p className="tnum no-print mt-2 text-center text-[11px] text-white/40">
          {t(dict.pageIndicator, { page: pageNum, total: numPages })}
        </p>
      )}
      <p className="hidden text-[12px] print:block">{src}</p>
    </div>
  );
}

function ToolbarButton({
  onClick,
  disabled,
  active,
  label,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`inline-flex size-8 items-center justify-center rounded-lg text-white/80 transition-colors duration-150 hover:bg-white/15 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/80 ${
        active ? "bg-white/20 text-white" : ""
      }`}
    >
      {children}
    </button>
  );
}

function Thumbnail({
  pdf,
  pageNumber,
  active,
  onSelect,
}: {
  pdf: PDFDocumentProxy | null;
  pageNumber: number;
  active: boolean;
  onSelect: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendered = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pdf || rendered.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (rendered.current || !entries[0]?.isIntersecting) return;
        rendered.current = true;
        observer.disconnect();
        (async () => {
          const page = await pdf.getPage(pageNumber);
          const viewport = page.getViewport({ scale: 0.22 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          try {
            await page.render({ canvas, viewport }).promise;
          } catch {
            // ignore — a stale/cancelled thumbnail render isn't worth surfacing
          }
        })();
      },
      { threshold: 0.05 },
    );
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [pdf, pageNumber]);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active}
      className={`mb-2 block w-full overflow-hidden rounded-md border-2 transition-colors duration-150 ${
        active ? "border-primary" : "border-transparent hover:border-white/30"
      }`}
    >
      <canvas ref={canvasRef} className="w-full bg-white" />
      <span className="tnum block bg-black/30 py-0.5 text-center text-[10px] text-white/80">{pageNumber}</span>
    </button>
  );
}
