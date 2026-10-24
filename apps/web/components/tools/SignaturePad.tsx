"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./pdfEditor.module.css";

const INKS = [
  { label: "Black", value: "#111111" },
  { label: "Blue", value: "#1d4ed8" },
];

/**
 * Draw a signature with a finger or mouse, or upload a picture of one.
 * Returns a PNG (transparent background, trimmed to the ink) and its width/height ratio.
 */
export default function SignaturePad({ onDone, onCancel }: { onDone: (src: string, ratio: number) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState(INKS[0].value);
  const [empty, setEmpty] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = point(e);
  };
  const moveTo = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const p = point(e);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    setEmpty(false);
  };
  const up = () => {
    drawing.current = false;
    last.current = null;
  };

  const clear = () => {
    const c = canvasRef.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setEmpty(true);
  };

  /** Crops a canvas to its non-transparent pixels. */
  const trimmed = (source: HTMLCanvasElement) => {
    const ctx = source.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
    let minX = width, minY = height, maxX = -1, maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (data[(y * width + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return null;
    const pad = 6;
    const out = document.createElement("canvas");
    out.width = maxX - minX + 1 + pad * 2;
    out.height = maxY - minY + 1 + pad * 2;
    out.getContext("2d")!.drawImage(source, minX - pad, minY - pad, out.width, out.height, 0, 0, out.width, out.height);
    return out;
  };

  const useDrawn = () => {
    const out = trimmed(canvasRef.current!);
    if (out) onDone(out.toDataURL("image/png"), out.width / out.height);
  };

  /** A photo or scan of a signature: the light paper is made transparent so only the ink shows. */
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1200 / bitmap.width);
      const c = document.createElement("canvas");
      c.width = Math.round(bitmap.width * scale);
      c.height = Math.round(bitmap.height * scale);
      const ctx = c.getContext("2d")!;
      ctx.drawImage(bitmap, 0, 0, c.width, c.height);
      bitmap.close();
      const img = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const light = (img.data[i] + img.data[i + 1] + img.data[i + 2]) / 3;
        if (light > 200) img.data[i + 3] = 0;
      }
      ctx.putImageData(img, 0, 0);
      const out = trimmed(c);
      if (!out) throw new Error();
      onDone(out.toDataURL("image/png"), out.width / out.height);
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG of your signature on white paper.");
    }
  };

  return (
    <div className={styles.modalBackdrop} onPointerDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Create your signature">
        <div className={styles.modalTitle}>Your signature</div>
        <canvas
          ref={canvasRef}
          width={900}
          height={300}
          className={styles.pad}
          onPointerDown={down}
          onPointerMove={moveTo}
          onPointerUp={up}
          onPointerCancel={up}
          aria-label="Draw your signature here"
        />
        <div className={styles.padRow}>
          <span className={styles.padHint}>{empty ? "Sign above with your finger or mouse" : " "}</span>
          <div className={styles.inks}>
            {INKS.map((i) => (
              <button
                key={i.value}
                type="button"
                className={ink === i.value ? styles.inkActive : styles.ink}
                style={{ background: i.value }}
                aria-label={`${i.label} ink`}
                aria-pressed={ink === i.value}
                onClick={() => setInk(i.value)}
              />
            ))}
          </div>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.modalActions}>
          <label className={styles.ghost}>
            Upload an image
            <input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <span style={{ flex: 1 }} />
          <button type="button" className={styles.ghost} onClick={empty ? onCancel : clear}>
            {empty ? "Cancel" : "Clear"}
          </button>
          <button type="button" className={styles.solid} disabled={empty} onClick={useDrawn}>
            Use signature
          </button>
        </div>
      </div>
    </div>
  );
}
