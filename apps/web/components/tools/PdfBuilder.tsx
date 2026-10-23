"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatBytes } from "../../lib/files/format";
import { buildPdf, PdfOptions, SourceItem, toSourceItem } from "../../lib/tools/pdf";
import Dropzone from "./Dropzone";
import ResultCard from "./ResultCard";
import { ICONS, move, Tile, useDragOrder } from "./Tile";
import styles from "./tools.module.css";

type Entry = SourceItem & { id: string; preview: string | null; pages?: number };

const IMAGE_TYPES = /^image\/(jpeg|png|webp)$/;
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const isImage = (f: File) => IMAGE_TYPES.test(f.type) || IMAGE_EXT.test(f.name);

/**
 * Images → PDF and Merge PDF. Files are shown as tiles you can reorder,
 * rotate (images) and remove, then combined into one PDF in the browser.
 */
export default function PdfBuilder({ mode, accept, acceptLabel }: { mode: "images" | "merge"; accept: string; acceptLabel: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [options, setOptions] = useState<PdfOptions>({ pageSize: "a4", margin: "small", smaller: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; name: string; detail: string } | null>(null);
  const previews = useRef(new Set<string>());

  // Free thumbnail memory when leaving the page
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const add = useCallback(
    async (files: File[]) => {
      setError("");
      const rejected: string[] = [];
      const accepted = files.filter((f) => {
        const ok = mode === "merge" ? isImage(f) || /\.pdf$/i.test(f.name) || f.type === "application/pdf" : isImage(f);
        if (!ok) rejected.push(f.name);
        return ok;
      });
      if (rejected.length) setError(`Skipped ${rejected.length} file${rejected.length > 1 ? "s" : ""} that ${mode === "merge" ? "aren't PDFs or images" : "aren't JPG, PNG or WebP"}: ${rejected.slice(0, 3).join(", ")}`);

      const fresh: Entry[] = accepted.map((file) => {
        const item = toSourceItem(file);
        let preview: string | null = null;
        if (item.kind === "image") {
          preview = URL.createObjectURL(file);
          previews.current.add(preview);
        }
        return { ...item, id: crypto.randomUUID(), preview };
      });
      setEntries((list) => [...list, ...fresh]);

      // PDF tiles: first-page thumbnail and page count, loaded in the background
      const pdfs = fresh.filter((e) => e.kind === "pdf");
      if (pdfs.length) {
        const { openPreview, renderThumbnail } = await import("../../lib/tools/pdfPreview");
        for (const entry of pdfs) {
          try {
            const doc = await openPreview(entry.file);
            const url = await renderThumbnail(doc, 1);
            previews.current.add(url);
            setEntries((list) => list.map((e) => (e.id === entry.id ? { ...e, preview: url, pages: doc.numPages } : e)));
            doc.destroy();
          } catch (err) {
            setEntries((list) => list.filter((e) => e.id !== entry.id));
            setError(err instanceof Error ? err.message : "Couldn't read a PDF");
          }
        }
      }
    },
    [mode],
  );

  const onMove = useCallback((from: number, to: number) => setEntries((list) => move(list, from, to)), []);
  const drag = useDragOrder(onMove);

  const create = async () => {
    setBusy("Starting…");
    setError("");
    try {
      const inputSize = entries.reduce((s, e) => s + e.file.size, 0);
      const blob = await buildPdf(entries, options, (done) => setBusy(`Processing ${done} of ${entries.length}…`));
      const first = entries[0].file.name.replace(/\.[^.]+$/, "");
      const name = mode === "merge" ? "merged.pdf" : entries.length === 1 ? `${first}.pdf` : `${first}-and-${entries.length - 1}-more.pdf`;
      const pageCount = entries.reduce((s, e) => s + (e.kind === "pdf" ? e.pages ?? 0 : 1), 0);
      const detail = `${pageCount} page${pageCount === 1 ? "" : "s"}${options.smaller ? ` · ${formatBytes(inputSize)} → ${formatBytes(blob.size)}` : ""}`;
      setResult({ blob, name, detail });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  if (result) {
    return (
      <ResultCard
        blob={result.blob}
        fileName={result.name}
        detail={result.detail}
        onReset={() => {
          setResult(null);
          setEntries([]);
        }}
      />
    );
  }

  if (!entries.length) {
    return (
      <>
        <Dropzone accept={accept} acceptLabel={acceptLabel} multiple onFiles={add} />
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  const hasImages = entries.some((e) => e.kind === "image");
  const set = <K extends keyof PdfOptions>(k: K, v: PdfOptions[K]) => setOptions((o) => ({ ...o, [k]: v }));

  return (
    <>
      <div className={styles.grid}>
        {entries.map((e, i) => (
          <Tile
            key={e.id}
            index={i}
            total={entries.length}
            image={e.preview}
            rotation={e.kind === "image" ? e.rotation : 0}
            label={e.file.name}
            sublabel={e.kind === "pdf" ? (e.pages ? `${e.pages} p` : "…") : formatBytes(e.file.size)}
            badge={String(i + 1)}
            onMove={onMove}
            drag={drag}
            actions={[
              ...(e.kind === "image"
                ? [{ label: "Rotate", icon: ICONS.rotate, onClick: () => setEntries((l) => l.map((x) => (x.id === e.id && x.kind === "image" ? { ...x, rotation: (x.rotation + 90) % 360 } : x))) }]
                : []),
              { label: "Remove", icon: ICONS.remove, onClick: () => setEntries((l) => l.filter((x) => x.id !== e.id)) },
            ]}
          />
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <Dropzone accept={accept} acceptLabel={acceptLabel} multiple onFiles={add} compact />
      </div>

      {hasImages && (
        <div className={styles.options}>
          <div className={styles.option}>
            Page size
            <Segment value={options.pageSize} onChange={(v) => set("pageSize", v)} choices={[["a4", "A4"], ["letter", "Letter"], ["fit", "Fit to image"]]} />
          </div>
          <div className={styles.option}>
            Margins
            <Segment value={options.margin} onChange={(v) => set("margin", v)} choices={[["none", "None"], ["small", "Small"], ["large", "Large"]]} />
          </div>
          <label className={styles.toggle}>
            <input type="checkbox" checked={options.smaller} onChange={(e) => set("smaller", e.target.checked)} />
            Smaller file <span className={styles.muted}>(for upload portals)</span>
          </label>
        </div>
      )}

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actionsRow}>
        <span className={styles.muted}>
          {entries.length} file{entries.length === 1 ? "" : "s"} · drag to reorder
        </span>
        <button className={styles.primary} onClick={create} disabled={!!busy}>
          {busy ? (
            <>
              <span className={styles.spinner} /> {busy}
            </>
          ) : mode === "merge" ? (
            "Merge PDF"
          ) : (
            "Convert to PDF"
          )}
        </button>
      </div>
    </>
  );
}

export function Segment<T extends string>({ value, onChange, choices }: { value: T; onChange: (v: T) => void; choices: [T, string][] }) {
  return (
    <div className={styles.segment} role="radiogroup">
      {choices.map(([v, label]) => (
        <button key={v} role="radio" aria-checked={value === v} className={value === v ? styles.segmentActive : styles.segmentButton} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}
