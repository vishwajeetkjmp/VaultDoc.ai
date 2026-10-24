/**
 * Edit PDF: writes the editor's additions into the PDF, in the browser.
 *
 * Positions come from the editor in "page units": PDF points measured from the top-left of the page
 * as it is shown (page rotation applied). Text, signatures and whiteout are added on top of the page,
 * so the original stays sharp. A page with a redaction is different: it's redrawn as an image with
 * the black boxes burned in, because covering text with a box leaves the text in the file.
 */
import type { PDFDocument, PDFFont, PDFPage } from "pdf-lib";
import { openPreview, renderPageCanvas } from "./pdfPreview";

export type Box = { x: number; y: number; w: number; h: number };

export type Annotation =
  | { id: string; page: number; kind: "text"; x: number; y: number; text: string; size: number; color: string }
  | { id: string; page: number; kind: "image"; box: Box; src: string }
  | { id: string; page: number; kind: "whiteout" | "redact"; box: Box };

/** Text lines are 1.2 × the font size apart; the first baseline sits this far below the top (Helvetica/Arial). */
export const LINE_HEIGHT = 1.2;
const BASELINE = 0.9465;
/** Redacted pages are redrawn at this many pixels per point (about 180 dpi) */
const REDACT_SCALE = 2.5;

export class PdfEditError extends Error {}

/** Where a point shown at (u, v) on the page lies in the PDF's own coordinates. */
function toPdf(page: PDFPage, u: number, v: number): { x: number; y: number } {
  const { x: cx, y: cy, width: cw, height: ch } = page.getCropBox();
  switch (page.getRotation().angle % 360) {
    case 90:
      return { x: cx + v, y: cy + u };
    case 180:
      return { x: cx + cw - u, y: cy + v };
    case 270:
      return { x: cx + cw - v, y: cy + ch - u };
    default:
      return { x: cx + u, y: cy + ch - v };
  }
}

function rgb255(hex: string): [number, number, number] {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** The text's size on the page, measured with the PDF font. */
export function textBox(a: Extract<Annotation, { kind: "text" }>, measure: (line: string, size: number) => number): Box {
  const lines = a.text.split("\n");
  return { x: a.x, y: a.y, w: Math.max(...lines.map((l) => measure(l, a.size))), h: lines.length * a.size * LINE_HEIGHT };
}

/** Text the standard PDF font can't write (Hindi, emoji…) is drawn as a sharp image instead. */
function canEncode(font: PDFFont, text: string) {
  try {
    font.encodeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Draws text onto a canvas context in page units (used for images of text and for redacted pages). */
function paintText(ctx: CanvasRenderingContext2D, a: Extract<Annotation, { kind: "text" }>, scale: number, left: number, top: number) {
  ctx.fillStyle = a.color;
  ctx.font = `${a.size * scale}px Helvetica, Arial, sans-serif`;
  ctx.textBaseline = "alphabetic";
  a.text.split("\n").forEach((line, i) => ctx.fillText(line, left, top + (BASELINE + i * LINE_HEIGHT) * a.size * scale));
}

async function loadImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = src;
  await img.decode();
  return img;
}

function canvasPng(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error("Couldn't create an image"))), "image/png"),
  );
}

/** Adds the annotations of one page on top of its content. */
async function drawOnPage(doc: PDFDocument, page: PDFPage, items: Annotation[], font: PDFFont) {
  const { degrees, rgb } = await import("pdf-lib");
  const rotate = degrees(page.getRotation().angle % 360);

  // Covers first, so text and signatures can sit on top of a whited-out area
  for (const a of items) {
    if (a.kind !== "whiteout") continue;
    const p1 = toPdf(page, a.box.x, a.box.y);
    const p2 = toPdf(page, a.box.x + a.box.w, a.box.y + a.box.h);
    page.drawRectangle({ x: Math.min(p1.x, p2.x), y: Math.min(p1.y, p2.y), width: Math.abs(p2.x - p1.x), height: Math.abs(p2.y - p1.y), color: rgb(1, 1, 1) });
  }

  for (const a of items) {
    if (a.kind === "text") {
      if (!a.text.trim()) continue;
      if (canEncode(font, a.text)) {
        const color = rgb(...rgb255(a.color));
        a.text.split("\n").forEach((line, i) => {
          const at = toPdf(page, a.x, a.y + (BASELINE + i * LINE_HEIGHT) * a.size);
          page.drawText(line, { x: at.x, y: at.y, size: a.size, font, color, rotate });
        });
      } else {
        const box = textBox(a, (l, s) => font.widthOfTextAtSize(l.replace(/[^\x20-\x7e]/g, "W"), s) * 1.15);
        const scale = 4;
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(box.w * scale) + 8;
        canvas.height = Math.ceil(box.h * scale) + 8;
        paintText(canvas.getContext("2d")!, a, scale, 0, 0);
        const image = await doc.embedPng(await canvasPng(canvas));
        const at = toPdf(page, a.x, a.y + canvas.height / scale);
        page.drawImage(image, { x: at.x, y: at.y, width: canvas.width / scale, height: canvas.height / scale, rotate });
      }
    } else if (a.kind === "image") {
      const bytes = await (await fetch(a.src)).arrayBuffer();
      const image = await doc.embedPng(bytes);
      const at = toPdf(page, a.box.x, a.box.y + a.box.h);
      page.drawImage(image, { x: at.x, y: at.y, width: a.box.w, height: a.box.h, rotate });
    }
  }
}

/** Draws a page as an image with every annotation painted in, and adds it to `out`. */
async function addFlattenedPage(out: PDFDocument, index: number, items: Annotation[], previewDoc: Awaited<ReturnType<typeof openPreview>>) {
  const canvas = await renderPageCanvas(previewDoc, index + 1, REDACT_SCALE);
  const ctx = canvas.getContext("2d")!;
  const s = REDACT_SCALE;
  for (const kind of ["whiteout", "redact"] as const) {
    ctx.fillStyle = kind === "redact" ? "#000000" : "#ffffff";
    for (const a of items) if (a.kind === kind) ctx.fillRect(a.box.x * s, a.box.y * s, a.box.w * s, a.box.h * s);
  }
  for (const a of items) {
    if (a.kind === "text") paintText(ctx, a, s, a.x * s, a.y * s);
    if (a.kind === "image") ctx.drawImage(await loadImage(a.src), a.box.x * s, a.box.y * s, a.box.w * s, a.box.h * s);
  }
  const jpeg = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't redact"))), "image/jpeg", 0.9));
  const image = await out.embedJpg(await jpeg.arrayBuffer());
  const width = canvas.width / s;
  const height = canvas.height / s;
  out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
}

/**
 * Applies all edits and returns the new PDF. With a redaction, the result is a fresh PDF that gets
 * copies of the kept pages and images of the redacted ones: removing a page from the original would
 * still leave its text inside the file, where PDF tools can dig it out.
 */
export async function savePdfEdits(file: File, annotations: Annotation[]): Promise<Blob> {
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(await file.arrayBuffer());
  } catch {
    throw new PdfEditError(`“${file.name}” couldn't be opened. If it's password-protected, remove the password first.`);
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const byPage = new Map<number, Annotation[]>();
  for (const a of annotations) byPage.set(a.page, [...(byPage.get(a.page) ?? []), a]);
  const isRedacted = (index: number) => !!byPage.get(index)?.some((a) => a.kind === "redact");

  for (const [index, items] of byPage) if (!isRedacted(index)) await drawOnPage(doc, doc.getPage(index), items, font);
  if (![...byPage.keys()].some(isRedacted)) {
    return new Blob([(await doc.save()) as BlobPart], { type: "application/pdf" });
  }

  const out = await PDFDocument.create();
  const previewDoc = await openPreview(file);
  try {
    for (let i = 0; i < doc.getPageCount(); i++) {
      if (isRedacted(i)) await addFlattenedPage(out, i, byPage.get(i)!, previewDoc);
      else out.addPage((await out.copyPages(doc, [i]))[0]);
    }
  } finally {
    previewDoc.destroy();
  }
  return new Blob([(await out.save()) as BlobPart], { type: "application/pdf" });
}
