"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
import { ArrowUpRight, Download, Loader2 } from "lucide-react";

const WORKER_SRC = "/pdfjs/pdf.worker.min.mjs";

/**
 * pdfjs-dist 6.x uses a handful of very recent JS builtins internally, none
 * of which it feature-detects itself. Confirmed on real hardware (Samsung
 * Internet) that Map/WeakMap.prototype.getOrInsertComputed throws
 * immediately on an older Chromium build; grepping the shipped bundle for
 * other equally-new APIs turned up two more in reachable code paths
 * (Promise.try sits in the worker<->main-thread message plumbing, hit on
 * nearly every render; Uint8Array.fromBase64 fires for base64-embedded
 * fonts) — patching all three preemptively since we don't have the device
 * on hand to re-discover them one crash at a time. The worker thread gets
 * its own copy of this in copy-pdf-worker.mjs (a Worker is a separate JS
 * realm; patching window's builtins here doesn't reach it).
 */
function polyfillPdfjsRuntimeGaps() {
  const mapProto = Map.prototype as unknown as Record<string, unknown>;
  if (typeof mapProto.getOrInsertComputed !== "function") {
    mapProto.getOrInsertComputed = function (this: Map<unknown, unknown>, key: unknown, compute: (key: unknown) => unknown) {
      if (!this.has(key)) this.set(key, compute(key));
      return this.get(key);
    };
  }
  const weakMapProto = WeakMap.prototype as unknown as Record<string, unknown>;
  if (typeof weakMapProto.getOrInsertComputed !== "function") {
    weakMapProto.getOrInsertComputed = function (this: WeakMap<object, unknown>, key: object, compute: (key: object) => unknown) {
      if (!this.has(key)) this.set(key, compute(key));
      return this.get(key);
    };
  }

  const promiseCtor = Promise as unknown as Record<string, unknown>;
  if (typeof promiseCtor.try !== "function") {
    promiseCtor.try = function (fn: (...args: unknown[]) => unknown, ...args: unknown[]) {
      return new Promise((resolve) => resolve(fn(...args)));
    };
  }

  const uint8Ctor = Uint8Array as unknown as Record<string, unknown>;
  if (typeof uint8Ctor.fromBase64 !== "function") {
    uint8Ctor.fromBase64 = function (base64: string) {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    };
  }
}

interface PdfViewerProps {
  src: string;
  /** Tracked download endpoint (audit-logs the download, then redirects to `src`). */
  downloadHref: string;
  title: string;
  openLabel: string;
  downloadLabel: string;
}

/**
 * Renders the PDF ourselves onto <canvas> via pdf.js instead of an <iframe>
 * onto the browser's own PDF plugin — confirmed on real hardware that some
 * mainstream browsers (Samsung Internet) have no such plugin at all and show
 * nothing for an embedded PDF. Rendering client-side doesn't depend on the
 * browser having any PDF support to begin with. No toolbar, no zoom, no page
 * nav — just every page stacked and scrolled naturally. Falls back to the
 * Open/Download links (a real top-level navigation, which every browser
 * handles one way or another, confirmed on-device) if rendering fails.
 */
export function PdfViewer({ src, downloadHref, title, openLabel, downloadLabel }: PdfViewerProps) {
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PDFDocumentLoadingTask | undefined;

    (async () => {
      setStatus("loading");
      try {
        polyfillPdfjsRuntimeGaps();
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        loadingTask = pdfjsLib.getDocument({ url: src });
        const doc = await loadingTask.promise;
        if (cancelled) {
          loadingTask.destroy();
          return;
        }

        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = "";

        for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
          const page = await doc.getPage(pageNum);
          if (cancelled) return;

          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          const unscaledWidth = page.getViewport({ scale: 1 }).width;
          const scale = Math.min(2, (container.clientWidth || unscaledWidth) / unscaledWidth);
          const viewport = page.getViewport({ scale: scale * dpr });

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = `${viewport.width / dpr}px`;
          canvas.style.height = `${viewport.height / dpr}px`;
          canvas.className = "mx-auto block max-w-full rounded-lg shadow-sm" + (pageNum > 1 ? " mt-3" : "");
          container.appendChild(canvas);

          await page.render({ canvas, viewport }).promise;
          if (cancelled) return;
        }

        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setErrorDetail(error instanceof Error ? `${error.name}: ${error.message}` : String(error));
          setStatus("failed");
          // Don't make the patient tap anything — take them straight to the
          // file. A real top-level navigation to a PDF response always does
          // *something* (native inline view or a download/open-with prompt,
          // confirmed on-device), unlike embedding it, which some browsers
          // just render blank. replace() so "back" doesn't return here.
          window.location.replace(src);
        }
      }
    })();

    return () => {
      cancelled = true;
      loadingTask?.destroy();
    };
  }, [src]);

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
      {status === "failed" ? (
        <p className="no-print rounded-2xl border border-border bg-canvas px-4 py-6 text-center text-[12px] text-ink-faint">
          Opening your report… ({errorDetail}) — if nothing happens, use the buttons above.
        </p>
      ) : (
        <div className="no-print overflow-hidden rounded-2xl border border-border bg-canvas p-3">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 py-16 text-ink-muted">
              <Loader2 aria-hidden className="size-5 animate-spin" />
            </div>
          )}
          <div ref={containerRef} role="img" aria-label={title} className={status === "loading" ? "hidden" : ""} />
        </div>
      )}
      <p className="hidden text-[12px] print:block">{src}</p>
    </div>
  );
}
