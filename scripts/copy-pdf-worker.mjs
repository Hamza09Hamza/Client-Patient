// pdfjs-dist ships its rendering worker as a standalone file; we serve it as a
// static asset (rather than letting the bundler try to resolve a Worker import)
// so Turbopack never has to reason about it. Re-run on every install so the
// copy always matches the installed pdfjs-dist version.
//
// Also prepends polyfills for a few very recent JS builtins pdfjs-dist 6.x
// calls internally without feature-detecting: Map/WeakMap.prototype.
// getOrInsertComputed (confirmed on real hardware — Samsung Internet's
// Chromium build throws immediately without it), Promise.try (sits in the
// worker<->main-thread message plumbing, hit on nearly every render), and
// Uint8Array.fromBase64 (fires for base64-embedded fonts). The worker runs in
// its own JS realm, so the same polyfills applied on the main thread
// (src/components/portal/pdf-viewer.tsx) don't reach it; they have to live
// in this file too.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = join(root, "public/pdfjs");
const dest = join(destDir, "pdf.worker.min.mjs");

const POLYFILL = `if(typeof Map.prototype.getOrInsertComputed!=="function"){Map.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k);};}if(typeof WeakMap.prototype.getOrInsertComputed!=="function"){WeakMap.prototype.getOrInsertComputed=function(k,f){if(!this.has(k))this.set(k,f(k));return this.get(k);};}if(typeof Promise.try!=="function"){Promise.try=function(f,...a){return new Promise(r=>r(f(...a)));};}if(typeof Uint8Array.fromBase64!=="function"){Uint8Array.fromBase64=function(b64){const bin=atob(b64);const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out;};}\n`;

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
