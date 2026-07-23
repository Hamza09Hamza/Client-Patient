// pdfjs-dist ships its rendering worker as a standalone file; we serve it as a
// static asset (rather than letting the bundler try to resolve a Worker import)
// so Turbopack never has to reason about it. Re-run on every install so the
// copy always matches the installed pdfjs-dist version.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules/pdfjs-dist/build/pdf.worker.min.mjs");
const destDir = join(root, "public/pdfjs");
const dest = join(destDir, "pdf.worker.min.mjs");

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("copied pdf.worker.min.mjs -> public/pdfjs/");
