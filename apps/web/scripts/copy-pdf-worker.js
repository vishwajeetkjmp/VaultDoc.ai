// Copies pdf.js's worker into public/ so it's served as a plain static file.
// Bundling it breaks the production build (Next's minifier rejects the ES module),
// and copying from node_modules keeps it in step with the installed pdfjs-dist.
const fs = require("node:fs");
const path = require("node:path");

const source = require.resolve("pdfjs-dist/build/pdf.worker.min.mjs");
const target = path.join(__dirname, "..", "public", "pdf.worker.min.mjs");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
