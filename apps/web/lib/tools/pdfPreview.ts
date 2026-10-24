/**
 * Page thumbnails for PDF tools, drawn with pdf.js (Mozilla's PDF renderer).
 * Loaded on first use; rendering runs in a Web Worker so the page stays responsive.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

let pdfjs: typeof import("pdfjs-dist") | null = null;

async function load() {
  if (!pdfjs) {
    pdfjs = await import("pdfjs-dist");
    // Copied into public/ by scripts/copy-pdf-worker.js before dev and build
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  }
  return pdfjs;
}

export async function openPreview(file: File): Promise<PDFDocumentProxy> {
  const lib = await load();
  try {
    return await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") {
      throw new Error(`“${file.name}” is password-protected. Remove the password first, then try again.`);
    }
    throw new Error(`“${file.name}” doesn't look like a valid PDF.`);
  }
}

/** Renders one page (1-based) to a small image URL, about `width` pixels wide. */
export async function renderThumbnail(doc: PDFDocumentProxy, pageNumber: number, width = 220): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: (width * (window.devicePixelRatio || 1)) / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  // "print" intent renders without waiting for animation frames, which browsers
  // pause in background tabs; otherwise thumbnails would stall until the tab is shown
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, intent: "print" }).promise;
  page.cleanup();
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.8));
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL();
}

/** Page sizes as shown (in PDF points, page rotation applied), for laying out editors. */
export async function pageSizes(doc: PDFDocumentProxy): Promise<{ width: number; height: number }[]> {
  const sizes = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    sizes.push({ width, height });
  }
  return sizes;
}

/** Renders one page (1-based) onto a new canvas at `scale` pixels per point. */
export async function renderPageCanvas(doc: PDFDocumentProxy, pageNumber: number, scale: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, intent: "print" }).promise;
  page.cleanup();
  return canvas;
}
