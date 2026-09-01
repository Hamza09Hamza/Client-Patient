// pdfjs-dist ships its rendering worker as a standalone file; we serve it as a
// static asset (rather than letting the bundler try to resolve a Worker import)
// so Turbopack never has to reason about it. Re-run on every install so the
// copy always matches the installed pdfjs-dist version.
//
// Also prepends a polyfill for Map/WeakMap.prototype.getOrInsertComputed (the
// TC39 "Map upsert" method, which pdfjs-dist 6.x calls internally) — confirmed
// on real hardware that Samsung Internet's Chromium build doesn't have it yet
// and throws immediately. The worker runs in its own JS realm, so the same
// polyfill applied on the main thread (src/components/portal/pdf-viewer.tsx)
// doesn't reach it; it has to live in this file too.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = join(root, "public/pdfjs");
const dest = join(destDir, "pdf.worker.min.mjs");

const POLYFILL = `if(typeof Map.prototype.getOrInsertComputed!=="function"){Map.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k);};}if(typeof WeakMap.prototype.getOrInsertComputed!=="function"){WeakMap.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k);};}\n`;

mkdirSync(destDir, { recursive: true });
try {
  const workerSource = readFileSync(src, "utf8");
  writeFileSync(dest, POLYFILL + workerSource);
  console.log("copied pdf.worker.min.mjs -> public/pdfjs/ (with Map upsert polyfill prepended)");
} catch (error) {
  // Fall back to a plain copy rather than leaving no worker file at all.
  copyFileSync(src, dest);
  console.warn("copied pdf.worker.min.mjs -> public/pdfjs/ (polyfill prepend failed, plain copy used)", error);
}
