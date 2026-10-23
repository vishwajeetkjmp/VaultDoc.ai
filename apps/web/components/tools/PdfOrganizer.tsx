"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { editPdf } from "../../lib/tools/pdf";
import Dropzone from "./Dropzone";
import ResultCard from "./ResultCard";
import { ICONS, move, Tile, useDragOrder } from "./Tile";
import styles from "./tools.module.css";

type Page = { index: number; rotation: number; selected: boolean; thumb: string | null };
type Focus = "reorder" | "rotate" | "remove";

const VERB: Record<Focus, string> = { reorder: "reordered", rotate: "rotated", remove: "edited" };

/**
 * Reorder, rotate and remove pages of one PDF. Every page is shown as a
 * thumbnail; all three actions are available, the tool's focus decides
 * which one leads.
 */
export default function PdfOrganizer({ focus }: { focus: Focus }) {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; name: string; detail: string } | null>(null);
  const urls = useRef(new Set<string>());
  const run = useRef(0);

  useEffect(() => {
    const set = urls.current;
    return () => set.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const open = useCallback(async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      setError("Please choose a PDF file.");
      return;
    }
    const thisRun = ++run.current;
    setError("");
    setLoading(true);
    setFile(f);
    setPages([]);
    try {
      const { openPreview, renderThumbnail } = await import("../../lib/tools/pdfPreview");
      const doc = await openPreview(f);
      setPages(Array.from({ length: doc.numPages }, (_, i) => ({ index: i, rotation: 0, selected: false, thumb: null })));
      setLoading(false);
      // Thumbnails one by one, so the first pages appear quickly even for long PDFs
      for (let i = 0; i < doc.numPages; i++) {
        if (run.current !== thisRun) break; // a different file was opened
        const url = await renderThumbnail(doc, i + 1, 180);
        urls.current.add(url);
        setPages((list) => list.map((p) => (p.index === i ? { ...p, thumb: url } : p)));
      }
      doc.destroy();
    } catch (e) {
      setFile(null);
      setLoading(false);
      setError(e instanceof Error ? e.message : "Couldn't open that PDF.");
    }
  }, []);

  const onMove = useCallback((from: number, to: number) => setPages((list) => move(list, from, to)), []);
  const drag = useDragOrder(onMove);
  const update = (i: number, fn: (p: Page) => Page) => setPages((list) => list.map((p, k) => (k === i ? fn(p) : p)));

  const rotateAll = (deg: number) => setPages((list) => list.map((p) => ({ ...p, rotation: (p.rotation + deg + 360) % 360 })));
  const toRemove = pages.filter((p) => p.selected).length;
  const kept = pages.filter((p) => !p.selected);
  const changed = pages.some((p, i) => p.index !== i || p.rotation || p.selected);

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const blob = await editPdf(file, kept.map((p) => ({ index: p.index, rotation: p.rotation })));
      const base = file.name.replace(/\.pdf$/i, "");
      const detail = `${kept.length} page${kept.length === 1 ? "" : "s"}${toRemove ? ` · ${toRemove} removed` : ""}`;
      setResult({ blob, name: `${base}-${VERB[focus]}.pdf`, detail });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
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
          setFile(null);
          setPages([]);
        }}
      />
    );
  }

  if (!file) {
    return (
      <>
        <Dropzone accept=".pdf,application/pdf" acceptLabel="PDF" multiple={false} onFiles={open} />
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  const hint =
    focus === "reorder" ? "Drag pages (or use the arrows) to change the order." : focus === "rotate" ? "Rotate single pages with ↻, or all pages at once." : "Tap the pages you want to delete.";

  return (
    <>
      <div className={styles.options}>
        <div className={styles.option} style={{ flex: 1, minWidth: 200 }}>
          {file.name}
          <span className={styles.muted} style={{ fontWeight: 400 }}>
            {loading ? "Reading pages…" : `${pages.length} pages · ${hint}`}
          </span>
        </div>
        {focus === "rotate" && (
          <div style={{ display: "flex", gap: 8 }}>
            <button className={styles.secondary} onClick={() => rotateAll(-90)}>
              ↺ Rotate all left
            </button>
            <button className={styles.secondary} onClick={() => rotateAll(90)}>
              ↻ Rotate all right
            </button>
          </div>
        )}
        {focus === "remove" && toRemove > 0 && (
          <button className={styles.secondary} onClick={() => setPages((l) => l.map((p) => ({ ...p, selected: false })))}>
            Clear selection
          </button>
        )}
        <button className={styles.secondary} onClick={() => { setFile(null); setPages([]); }}>
          Choose another PDF
        </button>
      </div>

      <div className={styles.grid}>
        {pages.map((p, i) => (
          <Tile
            key={p.index}
            index={i}
            total={pages.length}
            image={p.thumb}
            rotation={p.rotation}
            label={`Page ${p.index + 1}`}
            badge={String(i + 1)}
            selected={p.selected}
            onMove={onMove}
            drag={drag}
            onClick={focus === "remove" ? () => update(i, (x) => ({ ...x, selected: !x.selected })) : undefined}
            actions={[
              { label: "Rotate", icon: ICONS.rotate, onClick: () => update(i, (x) => ({ ...x, rotation: (x.rotation + 90) % 360 })) },
              { label: p.selected ? "Keep" : "Remove", icon: ICONS.remove, onClick: () => update(i, (x) => ({ ...x, selected: !x.selected })) },
            ]}
          />
        ))}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actionsRow}>
        <span className={styles.muted}>
          {toRemove ? `${toRemove} page${toRemove === 1 ? "" : "s"} will be removed · ` : ""}
          {kept.length} page{kept.length === 1 ? "" : "s"} in the new PDF
        </span>
        <button className={styles.primary} onClick={save} disabled={busy || loading || !changed || kept.length === 0}>
          {busy ? (
            <>
              <span className={styles.spinner} /> Saving…
            </>
          ) : kept.length === 0 ? (
            "Keep at least one page"
          ) : !changed ? (
            focus === "remove" ? "Select pages to remove" : focus === "rotate" ? "Rotate a page first" : "Change the order first"
          ) : (
            "Download new PDF"
          )}
        </button>
      </div>
    </>
  );
}
