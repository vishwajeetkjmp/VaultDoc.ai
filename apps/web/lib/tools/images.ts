/**
 * Image helpers for the free tools. Everything runs in the browser with
 * createImageBitmap + canvas; nothing is uploaded.
 */

export type OutputFormat = "image/jpeg" | "image/png" | "image/webp";

/** Decodes an image, applying the phone camera's rotation (EXIF) so photos aren't sideways. */
export async function decodeImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This image couldn't be read. Try a JPG, PNG or WebP file.");
  }
}

export type Rect = { x: number; y: number; width: number; height: number };

/**
 * Draws (part of) an image onto a canvas at the requested size, optionally
 * rotated by 90° steps. JPEG output gets a white background so transparent
 * areas don't turn black.
 */
export function render(
  source: ImageBitmap,
  {
    crop = { x: 0, y: 0, width: source.width, height: source.height },
    width = crop.width,
    height = crop.height,
    rotation = 0,
    background,
  }: { crop?: Rect; width?: number; height?: number; rotation?: number; background?: string } = {},
): HTMLCanvasElement {
  const quarter = ((rotation % 360) + 360) % 360;
  const swap = quarter === 90 || quarter === 270;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(swap ? height : width));
  canvas.height = Math.max(1, Math.round(swap ? width : height));
  const ctx = canvas.getContext("2d")!;
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((quarter * Math.PI) / 180);
  ctx.drawImage(source, crop.x, crop.y, crop.width, crop.height, -width / 2, -height / 2, width, height);
  return canvas;
}

export function toBlob(canvas: HTMLCanvasElement, type: OutputFormat, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Couldn't create the image"))), type, quality),
  );
}

/** Largest side limited to `max` pixels, keeping proportions. */
export function fitWithin(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Encode that fits under `maxBytes` with as little loss as possible.
 * Starts at a resolution that suits the size limit (a 50 KB photo doesn't
 * need 12 megapixels), shrinks in one estimated jump when even low quality
 * is too big, then binary-searches the best quality that fits. About 7
 * small encodes instead of dozens of full-size ones. PNG has no quality
 * setting, so only the size changes.
 */
export async function encodeUnder(
  draw: (scale: number) => HTMLCanvasElement,
  type: OutputFormat,
  maxBytes: number,
  pixels: number,
): Promise<{ blob: Blob; quality: number | null; scale: number }> {
  const FLOOR = 0.4;
  // ~16 pixels per byte is roughly what a JPEG/WebP photo needs at decent quality
  let scale = Math.min(1, Math.sqrt((maxBytes * (type === "image/png" ? 4 : 16)) / pixels));
  for (let attempt = 0; attempt < 8; attempt++) {
    const canvas = draw(scale);
    const smallest = await toBlob(canvas, type, type === "image/png" ? undefined : FLOOR);
    if (smallest.size > maxBytes) {
      // Bytes grow with pixel count, so shrink both sides by the square root of the overshoot
      scale *= Math.min(0.9, Math.sqrt(maxBytes / smallest.size) * 0.95);
      continue;
    }
    if (type === "image/png") return { blob: smallest, quality: null, scale };
    let best = smallest;
    let bestQ = FLOOR;
    let lo = FLOOR;
    let hi = 0.95;
    for (let i = 0; i < 5; i++) {
      const q = (lo + hi) / 2;
      const blob = await toBlob(canvas, type, q);
      if (blob.size <= maxBytes) {
        best = blob;
        bestQ = q;
        lo = q;
      } else {
        hi = q;
      }
    }
    return { blob: best, quality: bestQ, scale };
  }
  throw new Error("Couldn't get the image that small. Try cropping it, or a larger size limit.");
}
