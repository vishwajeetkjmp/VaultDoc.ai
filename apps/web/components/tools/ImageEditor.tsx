"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "../../lib/files/format";
import { decodeImage, encodeUnder, OutputFormat, Rect, render, toBlob } from "../../lib/tools/images";
import Dropzone from "./Dropzone";
import { Segment } from "./PdfBuilder";
import ResultCard from "./ResultCard";
import styles from "./tools.module.css";

const RATIOS: [string, string, number | null][] = [
  ["free", "Free", null],
  ["1:1", "Square", 1],
  ["35:45", "Passport 3.5×4.5", 35 / 45],
  ["4:3", "4:3", 4 / 3],
  ["3:4", "3:4", 3 / 4],
  ["16:9", "16:9", 16 / 9],
];
const SIZE_LIMITS: [string, string, number | null][] = [
  ["best", "Best quality", null],
  ["20", "Under 20 KB", 20 * 1024],
  ["50", "Under 50 KB", 50 * 1024],
  ["100", "Under 100 KB", 100 * 1024],
  ["200", "Under 200 KB", 200 * 1024],
];
const EXT: Record<OutputFormat, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

type Drag = { mode: "move" | "nw" | "ne" | "sw" | "se"; startX: number; startY: number; start: Rect };

/** Crop, rotate, resize and shrink one image to a size limit — all in the browser. */
export default function ImageEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [bitmap, setBitmap] = useState<ImageBitmap | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<Rect>({ x: 0, y: 0, width: 1, height: 1 });
  const [ratioKey, setRatioKey] = useState("free");
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [format, setFormat] = useState<OutputFormat>("image/jpeg");
  const [limitKey, setLimitKey] = useState("best");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; name: string; detail: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);

  // Output size follows the crop (keeping the crop's proportions)
  const setOutputFromCrop = (r: Rect) => {
    setWidth(Math.round(r.width));
    setHeight(Math.round(r.height));
  };

  const load = useCallback(async (bmp: ImageBitmap, source: File) => {
    const canvas = render(bmp, { width: Math.min(bmp.width, 1400), height: (Math.min(bmp.width, 1400) / bmp.width) * bmp.height });
    const url = URL.createObjectURL(await toBlob(canvas, "image/jpeg", 0.85));
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    setBitmap(bmp);
    const full = { x: 0, y: 0, width: bmp.width, height: bmp.height };
    setCrop(full);
    setRatioKey("free");
    setOutputFromCrop(full);
    setFormat(source.type === "image/png" ? "image/png" : source.type === "image/webp" ? "image/webp" : "image/jpeg");
  }, []);

  const open = useCallback(
    async (files: File[]) => {
      const f = files[0];
      if (!f) return;
      setError("");
      try {
        const bmp = await decodeImage(f);
        setFile(f);
        await load(bmp, f);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't open that image.");
      }
    },
    [load],
  );

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  if (result) {
    return (
      <ResultCard
        blob={result.blob}
        fileName={result.name}
        detail={result.detail}
        onReset={() => {
          setResult(null);
          setFile(null);
          setBitmap(null);
        }}
      />
    );
  }

  if (!file || !bitmap || !preview) {
    return (
      <>
        <Dropzone accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" acceptLabel="JPG, PNG, WebP" multiple={false} onFiles={open} />
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  const ratio = RATIOS.find(([k]) => k === ratioKey)?.[2] ?? null;

  const applyRatio = (key: string) => {
    setRatioKey(key);
    const r = RATIOS.find(([k]) => k === key)?.[2];
    if (!r) return;
    // Largest centred box with this ratio
    let w = bitmap.width;
    let h = w / r;
    if (h > bitmap.height) {
      h = bitmap.height;
      w = h * r;
    }
    const next = { x: (bitmap.width - w) / 2, y: (bitmap.height - h) / 2, width: w, height: h };
    setCrop(next);
    setOutputFromCrop(next);
  };

  const rotate = async () => {
    const canvas = render(bitmap, { rotation: 90 });
    const bmp = await createImageBitmap(canvas);
    bitmap.close();
    await load(bmp, file);
  };

  // ----- crop box dragging (coordinates in image pixels) -----
  const scale = () => (stage.current ? stage.current.clientWidth / bitmap.width : 1);
  const startDrag = (mode: Drag["mode"]) => (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { mode, startX: e.clientX, startY: e.clientY, start: crop };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const s = scale();
    const dx = (e.clientX - d.startX) / s;
    const dy = (e.clientY - d.startY) / s;
    const min = 20;
    let { x, y, width: w, height: h } = d.start;
    if (d.mode === "move") {
      x = Math.min(Math.max(0, x + dx), bitmap.width - w);
      y = Math.min(Math.max(0, y + dy), bitmap.height - h);
    } else {
      const left = d.mode === "nw" || d.mode === "sw";
      const top = d.mode === "nw" || d.mode === "ne";
      let nw = Math.max(min, w + (left ? -dx : dx));
      let nh = Math.max(min, h + (top ? -dy : dy));
      if (ratio) nh = nw / ratio;
      // Keep inside the image
      const maxW = left ? x + w : bitmap.width - x;
      const maxH = top ? y + h : bitmap.height - y;
      if (nw > maxW) {
        nw = maxW;
        if (ratio) nh = nw / ratio;
      }
      if (nh > maxH) {
        nh = maxH;
        if (ratio) nw = nh * ratio;
      }
      x = left ? x + w - nw : x;
      y = top ? y + h - nh : y;
      w = nw;
      h = nh;
    }
    const next = { x, y, width: w, height: h };
    setCrop(next);
    setOutputFromCrop(next);
  };
  const endDrag = () => (drag.current = null);

  const setW = (v: number) => {
    setWidth(v);
    setHeight(Math.round((v * crop.height) / crop.width));
  };
  const setH = (v: number) => {
    setHeight(v);
    setWidth(Math.round((v * crop.width) / crop.height));
  };

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const limit = SIZE_LIMITS.find(([k]) => k === limitKey)?.[2] ?? null;
      const background = format === "image/jpeg" ? "#ffffff" : undefined;
      const draw = (k: number) => render(bitmap, { crop, width: Math.max(1, width * k), height: Math.max(1, height * k), background });
      let blob: Blob;
      let finalW = width;
      let finalH = height;
      if (limit) {
        const out = await encodeUnder(draw, format, limit, width * height);
        blob = out.blob;
        finalW = Math.round(width * out.scale);
        finalH = Math.round(height * out.scale);
      } else {
        blob = await toBlob(draw(1), format, format === "image/png" ? undefined : 0.92);
      }
      const base = file.name.replace(/\.[^.]+$/, "");
      setResult({
        blob,
        name: `${base}-${finalW}x${finalH}.${EXT[format]}`,
        detail: `${finalW}×${finalH}px · ${formatBytes(file.size)} → ${formatBytes(blob.size)}`,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, total: number) => `${(v / total) * 100}%`;

  return (
    <>
      <div className={styles.options}>
        <div className={styles.option}>
          Crop
          <Segment value={ratioKey} onChange={applyRatio} choices={RATIOS.map(([k, label]) => [k, label])} />
        </div>
        <button className={styles.secondary} onClick={rotate}>
          ↻ Rotate
        </button>
        <button className={styles.secondary} onClick={() => setFile(null)}>
          Choose another image
        </button>
      </div>

      <div
        style={{ position: "relative", margin: "20px auto 0", maxWidth: "100%", width: Math.min(760, (bitmap.width / bitmap.height) * 520), touchAction: "none" }}
        ref={stage}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" style={{ display: "block", width: "100%", borderRadius: 8, userSelect: "none" }} draggable={false} />
        <div
          onPointerDown={startDrag("move")}
          aria-label="Crop area"
          style={{
            position: "absolute",
            left: pct(crop.x, bitmap.width),
            top: pct(crop.y, bitmap.height),
            width: pct(crop.width, bitmap.width),
            height: pct(crop.height, bitmap.height),
            border: "2px solid #fff",
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
            cursor: "move",
            borderRadius: 2,
          }}
        >
          {(["nw", "ne", "sw", "se"] as const).map((c) => (
            <span
              key={c}
              onPointerDown={startDrag(c)}
              style={{
                position: "absolute",
                width: 18,
                height: 18,
                background: "#fff",
                borderRadius: 4,
                boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                left: c.includes("w") ? -10 : undefined,
                right: c.includes("e") ? -10 : undefined,
                top: c.startsWith("n") ? -10 : undefined,
                bottom: c.startsWith("s") ? -10 : undefined,
                cursor: c === "nw" || c === "se" ? "nwse-resize" : "nesw-resize",
                touchAction: "none",
              }}
            />
          ))}
        </div>
      </div>

      <div className={styles.options}>
        <div className={styles.option}>
          Size (px)
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="number" min={1} value={width} onChange={(e) => setW(Math.max(1, +e.target.value))} aria-label="Width in pixels" style={numberInput} />
            <span>×</span>
            <input type="number" min={1} value={height} onChange={(e) => setH(Math.max(1, +e.target.value))} aria-label="Height in pixels" style={numberInput} />
          </div>
        </div>
        <div className={styles.option}>
          Scale
          <Segment
            value={String(Math.round((width / crop.width) * 100))}
            onChange={(v) => setW(Math.round((crop.width * +v) / 100))}
            choices={[["100", "100%"], ["75", "75%"], ["50", "50%"], ["25", "25%"]]}
          />
        </div>
        <div className={styles.option}>
          Format
          <Segment value={format} onChange={setFormat} choices={[["image/jpeg", "JPG"], ["image/png", "PNG"], ["image/webp", "WebP"]]} />
        </div>
        <div className={styles.option}>
          File size
          <Segment value={limitKey} onChange={setLimitKey} choices={SIZE_LIMITS.map(([k, label]) => [k, label])} />
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actionsRow}>
        <span className={styles.muted}>
          Original {bitmap.width}×{bitmap.height}px · {formatBytes(file.size)}
        </span>
        <button className={styles.primary} onClick={save} disabled={busy}>
          {busy ? (
            <>
              <span className={styles.spinner} /> Working…
            </>
          ) : (
            "Download image"
          )}
        </button>
      </div>
    </>
  );
}

const numberInput: React.CSSProperties = {
  width: 90,
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--bg)",
  color: "var(--text)",
  font: "inherit",
};
