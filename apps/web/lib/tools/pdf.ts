/**
 * PDF building and editing for the free tools, in the browser with pdf-lib.
 * pdf-lib is loaded on first use, so tool pages stay light until someone
 * actually makes a PDF.
 */
import type { PDFDocument as PDFDocumentType } from "pdf-lib";
import { decodeImage, fitWithin, render, toBlob } from "./images";

export type PageSize = "a4" | "letter" | "fit";
export type Margin = "none" | "small" | "large";
export type PdfOptions = { pageSize: PageSize; margin: Margin; smaller: boolean };

const PAGE_POINTS: Record<Exclude<PageSize, "fit">, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
};
const MARGIN_POINTS: Record<Margin, number> = { none: 0, small: 24, large: 48 };

const lib = () => import("pdf-lib");

export class PdfError extends Error {}

/** Opens a PDF, with a friendly message for password-protected or damaged files. */
async function openPdf(bytes: ArrayBuffer, name: string): Promise<PDFDocumentType> {
  const { PDFDocument } = await lib();
  try {
    return await PDFDocument.load(bytes);
  } catch (e) {
    if (e instanceof Error && /encrypt/i.test(e.message)) {
      throw new PdfError(`“${name}” is password-protected. Remove the password first, then try again.`);
    }
    throw new PdfError(`“${name}” doesn't look like a valid PDF.`);
  }
}

/**
 * Adds one image as a page. Images are re-drawn through a canvas so phone
 * photos come out the right way up, transparency gets a white background,
 * and "smaller file" can lower resolution and quality.
 */
async function addImagePage(doc: PDFDocumentType, file: Blob, rotation: number, opts: PdfOptions) {
  const bitmap = await decodeImage(file);
  const max = opts.smaller ? 1600 : 3000;
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = render(bitmap, { width, height, rotation, background: "#ffffff" });
  bitmap.close();
  const jpeg = await toBlob(canvas, "image/jpeg", opts.smaller ? 0.68 : 0.9);
  const image = await doc.embedJpg(await jpeg.arrayBuffer());

  const margin = MARGIN_POINTS[opts.margin];
  // Image size in points at roughly 150 dpi, so "fit to image" pages are a sensible physical size
  const naturalW = (image.width * 72) / 150;
  const naturalH = (image.height * 72) / 150;
  let pageW: number;
  let pageH: number;
  if (opts.pageSize === "fit") {
    pageW = naturalW + margin * 2;
    pageH = naturalH + margin * 2;
  } else {
    const [w, h] = PAGE_POINTS[opts.pageSize];
    // Landscape pages for landscape images
    [pageW, pageH] = image.width > image.height ? [h, w] : [w, h];
  }
  const boxW = pageW - margin * 2;
  const boxH = pageH - margin * 2;
  const scale = Math.min(boxW / image.width, boxH / image.height);
  const drawW = image.width * scale;
  const drawH = image.height * scale;
  const page = doc.addPage([pageW, pageH]);
  page.drawImage(image, { x: (pageW - drawW) / 2, y: (pageH - drawH) / 2, width: drawW, height: drawH });
}

export type SourceItem =
  | { kind: "image"; file: File; rotation: number }
  | { kind: "pdf"; file: File };

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

export function toSourceItem(file: File): SourceItem {
  return isPdf(file) ? { kind: "pdf", file } : { kind: "image", file, rotation: 0 };
}

/** Builds one PDF from images and/or PDFs, in order. */
export async function buildPdf(items: SourceItem[], opts: PdfOptions, onProgress?: (done: number) => void): Promise<Blob> {
  const { PDFDocument } = await lib();
  const out = await PDFDocument.create();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === "image") {
      await addImagePage(out, item.file, item.rotation, opts);
    } else {
      const src = await openPdf(await item.file.arrayBuffer(), item.file.name);
      const pages = await out.copyPages(src, src.getPageIndices());
      pages.forEach((p) => out.addPage(p));
    }
    onProgress?.(i + 1);
  }
  out.setProducer("VaultDocAI");
  out.setCreator("VaultDocAI free tools");
  const bytes = await out.save({ useObjectStreams: true });
  return new Blob([bytes], { type: "application/pdf" });
}

export async function countPages(file: File): Promise<number> {
  const doc = await openPdf(await file.arrayBuffer(), file.name);
  return doc.getPageCount();
}

export type PageEdit = { index: number; rotation: number };

/**
 * Rebuilds a PDF with pages in a new order, rotated, or removed. Pages are
 * copied as they are (no re-printing), so text stays sharp and selectable.
 */
export async function editPdf(file: File, pages: PageEdit[]): Promise<Blob> {
  const { PDFDocument, degrees } = await lib();
  const src = await openPdf(await file.arrayBuffer(), file.name);
  const out = await PDFDocument.create();
  const copied = await out.copyPages(
    src,
    pages.map((p) => p.index),
  );
  copied.forEach((page, i) => {
    const extra = pages[i].rotation;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });
  out.setProducer("VaultDocAI");
  const bytes = await out.save({ useObjectStreams: true });
  return new Blob([bytes], { type: "application/pdf" });
}
