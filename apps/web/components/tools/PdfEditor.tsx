"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Annotation, Box } from "../../lib/tools/pdfEdit";
import Dropzone from "./Dropzone";
import ResultCard from "./ResultCard";
import SignaturePad from "./SignaturePad";
import toolStyles from "./tools.module.css";
import styles from "./pdfEditor.module.css";

type Mode = "select" | "text" | "sign" | "whiteout" | "redact";
type PageInfo = { width: number; height: number; url: string | null };
type TextAnnotation = Extract<Annotation, { kind: "text" }>;

/** Pointer gestures in progress: moving or resizing an item, or drawing a whiteout/redact box. */
type Gesture =
  | { kind: "move"; id: string; page: number; el: HTMLElement; startX: number; startY: number; orig: { x: number; y: number } }
  | { kind: "resize"; id: string; page: number; el: HTMLElement; startX: number; startY: number; orig: Box; ratio: number | null }
  | { kind: "draw"; page: number; el: HTMLElement; startX: number; startY: number; mode: "whiteout" | "redact" };

const TOOLS: { mode: Mode; label: string; icon: string; hint: string }[] = [
  { mode: "select", label: "Select", icon: "↖", hint: "Tap an item to move, resize or delete it." },
  { mode: "text", label: "Text", icon: "T", hint: "Tap where you want to type." },
  { mode: "sign", label: "Sign", icon: "✍", hint: "Tap where your signature should go." },
  { mode: "whiteout", label: "Whiteout", icon: "▭", hint: "Drag over what you want to cover with white." },
  { mode: "redact", label: "Redact", icon: "■", hint: "Drag over private details to remove them for good." },
];
const COLORS = ["#111111", "#1d4ed8", "#dc2626"];
const MIN_BOX = 6;

const newId = () => Math.random().toString(36).slice(2, 10);
const pct = (v: number, total: number) => `${(v / total) * 100}%`;

/** Pointer position on a page element, in page units (PDF points from the top-left of the page as shown). */
function unitsAt(e: { clientX: number; clientY: number }, el: HTMLElement, page: PageInfo) {
  const r = el.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * page.width, y: ((e.clientY - r.top) / r.height) * page.height };
}

/**
 * Edit PDF: shows every page, and lets you add text, a signature, whiteout boxes and redactions on top.
 * Nothing is uploaded; lib/tools/pdfEdit.ts writes the result in the browser.
 */
export default function PdfEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Annotation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("select");
  const [signature, setSignature] = useState<{ src: string; ratio: number } | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [draft, setDraft] = useState<{ page: number; box: Box; mode: "whiteout" | "redact" } | null>(null);
  const [textStyle, setTextStyle] = useState({ size: 14, color: COLORS[0] });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; name: string; detail: string } | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const draftRef = useRef<{ page: number; box: Box; mode: "whiteout" | "redact" } | null>(null);
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
    setItems([]);
    setSelected(null);
    try {
      const { openPreview, pageSizes, renderThumbnail } = await import("../../lib/tools/pdfPreview");
      const doc = await openPreview(f);
      const sizes = await pageSizes(doc);
      setPages(sizes.map((s) => ({ ...s, url: null })));
      setLoading(false);
      const width = doc.numPages > 40 ? 700 : 900;
      for (let i = 0; i < doc.numPages; i++) {
        if (run.current !== thisRun) break; // a different file was opened
        const url = await renderThumbnail(doc, i + 1, width);
        urls.current.add(url);
        setPages((list) => list.map((p, k) => (k === i ? { ...p, url } : p)));
      }
      doc.destroy();
    } catch (e) {
      setFile(null);
      setLoading(false);
      setError(e instanceof Error ? e.message : "Couldn't open that PDF.");
    }
  }, []);

  const update = useCallback((id: string, fn: (a: Annotation) => Annotation) => setItems((list) => list.map((a) => (a.id === id ? fn(a) : a))), []);
  const remove = useCallback((id: string) => {
    setItems((list) => list.filter((a) => a.id !== id));
    setSelected((s) => (s === id ? null : s));
  }, []);

  // Moving, resizing and drawing follow the pointer anywhere on the screen until it's released
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const g = gesture.current;
      if (!g) return;
      const page = pages[g.page];
      const p = unitsAt(e, g.el, page);
      const start = { x: g.startX, y: g.startY };
      if (g.kind === "move") {
        const dx = p.x - start.x;
        const dy = p.y - start.y;
        update(g.id, (a) =>
          a.kind === "text" ? { ...a, x: g.orig.x + dx, y: g.orig.y + dy } : { ...a, box: { ...a.box, x: g.orig.x + dx, y: g.orig.y + dy } },
        );
      } else if (g.kind === "resize") {
        const w = Math.max(MIN_BOX * 2, g.orig.w + p.x - start.x);
        const h = g.ratio ? w / g.ratio : Math.max(MIN_BOX, g.orig.h + p.y - start.y);
        update(g.id, (a) => (a.kind === "text" ? a : { ...a, box: { ...a.box, w, h } }));
      } else {
        const box = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
        draftRef.current = { page: g.page, box, mode: g.mode };
        setDraft(draftRef.current);
      }
    };
    const onUp = () => {
      const g = gesture.current;
      gesture.current = null;
      if (g?.kind === "draw") {
        const d = draftRef.current;
        draftRef.current = null;
        setDraft(null);
        if (d && d.box.w >= MIN_BOX && d.box.h >= MIN_BOX) {
          const id = newId();
          setItems((list) => [...list, { id, page: d.page, kind: d.mode, box: d.box }]);
          setSelected(id);
        }
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [pages, update]);

  // Delete removes the selected item (unless you're typing in it); Escape lets go of it
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.isContentEditable || /input|textarea/i.test((e.target as HTMLElement)?.tagName);
      if (e.key === "Escape") {
        setSelected(null);
        (document.activeElement as HTMLElement | null)?.blur();
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected && !typing) {
        e.preventDefault();
        remove(selected);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected, remove]);

  const chooseMode = (m: Mode) => {
    setMode(m);
    setSelected(null);
    if (m === "sign" && !signature) setPadOpen(true);
  };

  /** A press on the page itself (not on an item): add or start drawing, depending on the tool. */
  const pressPage = (e: React.PointerEvent<HTMLDivElement>, index: number) => {
    if (e.target !== e.currentTarget) return;
    const el = e.currentTarget;
    const page = pages[index];
    const p = unitsAt(e, el, page);
    if (mode === "select") {
      setSelected(null);
    } else if (mode === "text") {
      e.preventDefault();
      const id = newId();
      const item: TextAnnotation = { id, page: index, kind: "text", x: p.x, y: p.y - textStyle.size * 0.6, text: "", ...textStyle };
      setItems((list) => [...list, item]);
      setSelected(id);
      setMode("select");
    } else if (mode === "sign" && signature) {
      const w = Math.min(160, page.width * 0.4);
      const h = w / signature.ratio;
      const id = newId();
      setItems((list) => [...list, { id, page: index, kind: "image", box: { x: p.x - w / 2, y: p.y - h / 2, w, h }, src: signature.src }]);
      setSelected(id);
      setMode("select");
    } else if (mode === "whiteout" || mode === "redact") {
      e.preventDefault();
      gesture.current = { kind: "draw", page: index, el, startX: p.x, startY: p.y, mode };
      draftRef.current = { page: index, box: { x: p.x, y: p.y, w: 0, h: 0 }, mode };
      setDraft(draftRef.current);
    }
  };

  const startMove = (e: React.PointerEvent, a: Annotation) => {
    e.preventDefault();
    e.stopPropagation();
    setSelected(a.id);
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-page-layer]")!;
    const p = unitsAt(e, el, pages[a.page]);
    const orig = a.kind === "text" ? { x: a.x, y: a.y } : { x: a.box.x, y: a.box.y };
    gesture.current = { kind: "move", id: a.id, page: a.page, el, startX: p.x, startY: p.y, orig };
  };

  const startResize = (e: React.PointerEvent, a: Annotation) => {
    if (a.kind === "text") return;
    e.preventDefault();
    e.stopPropagation();
    const el = (e.currentTarget as HTMLElement).closest<HTMLElement>("[data-page-layer]")!;
    const p = unitsAt(e, el, pages[a.page]);
    gesture.current = { kind: "resize", id: a.id, page: a.page, el, startX: p.x, startY: p.y, orig: a.box, ratio: a.kind === "image" ? a.box.w / a.box.h : null };
  };

  const selectedItem = items.find((a) => a.id === selected) ?? null;
  const selectedText = selectedItem?.kind === "text" ? selectedItem : null;

  const setSize = (delta: number) => {
    const size = Math.min(72, Math.max(6, (selectedText?.size ?? textStyle.size) + delta));
    setTextStyle((s) => ({ ...s, size }));
    if (selectedText) update(selectedText.id, (a) => ({ ...a, size }) as Annotation);
  };
  const setColor = (color: string) => {
    setTextStyle((s) => ({ ...s, color }));
    if (selectedText) update(selectedText.id, (a) => ({ ...a, color }) as Annotation);
  };

  const save = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const { savePdfEdits } = await import("../../lib/tools/pdfEdit");
      const edits = items.filter((a) => a.kind !== "text" || a.text.trim());
      const blob = await savePdfEdits(file, edits);
      const redactedPages = new Set(edits.filter((a) => a.kind === "redact").map((a) => a.page)).size;
      const detail = `${edits.length} edit${edits.length === 1 ? "" : "s"}${redactedPages ? ` · ${redactedPages} page${redactedPages === 1 ? "" : "s"} redacted` : ""}`;
      setResult({ blob, name: `${file.name.replace(/\.pdf$/i, "")}-edited.pdf`, detail });
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
          setItems([]);
        }}
      />
    );
  }

  if (!file) {
    return (
      <>
        <Dropzone accept=".pdf,application/pdf" acceptLabel="PDF" multiple={false} onFiles={open} />
        {error && <p className={toolStyles.error}>{error}</p>}
      </>
    );
  }

  const hint = TOOLS.find((t) => t.mode === mode)!.hint;
  const hasRedaction = items.some((a) => a.kind === "redact");
  const edits = items.filter((a) => a.kind !== "text" || a.text.trim()).length;

  return (
    <div className={styles.editor}>
      <div className={styles.toolbar} role="toolbar" aria-label="Edit tools">
        <div className={styles.tools}>
          {TOOLS.map((t) => (
            <button key={t.mode} type="button" className={mode === t.mode ? styles.toolActive : styles.tool} aria-pressed={mode === t.mode} onClick={() => chooseMode(t.mode)}>
              <span className={styles.toolIcon} aria-hidden>
                {t.icon}
              </span>
              {t.label}
            </button>
          ))}
        </div>
        <button type="button" className={styles.download} disabled={busy || !edits} onClick={save}>
          {busy ? "Saving…" : "Download PDF"}
        </button>
      </div>

      <div className={styles.subbar}>
        {selectedText || mode === "text" ? (
          <div className={styles.textControls}>
            <button type="button" className={styles.small} onClick={() => setSize(-2)} aria-label="Smaller text">
              A−
            </button>
            <span className={styles.sizeLabel}>{selectedText?.size ?? textStyle.size} pt</span>
            <button type="button" className={styles.small} onClick={() => setSize(2)} aria-label="Bigger text">
              A+
            </button>
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={(selectedText?.color ?? textStyle.color) === c ? styles.swatchActive : styles.swatch}
                style={{ background: c }}
                aria-label={`Text colour ${c}`}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        ) : (
          <span className={styles.hint}>{loading ? "Reading pages…" : hint}</span>
        )}
        {mode === "sign" && signature && (
          <button type="button" className={styles.small} onClick={() => setPadOpen(true)}>
            New signature
          </button>
        )}
        {hasRedaction && <span className={styles.note}>Redacted pages are saved as images, so the hidden text can&apos;t be recovered.</span>}
        {selectedItem && (
          <button type="button" className={styles.delete} onClick={() => remove(selectedItem.id)}>
            Delete
          </button>
        )}
      </div>
      {error && <p className={toolStyles.error}>{error}</p>}

      <div className={styles.pages}>
        {pages.map((page, index) => (
          <div key={index} className={styles.pageWrap}>
            <div className={styles.page} style={{ aspectRatio: `${page.width} / ${page.height}` }}>
              {page.url ? <img src={page.url} alt={`Page ${index + 1}`} className={styles.pageImage} draggable={false} /> : <div className={styles.pageLoading} />}
              <div
                className={styles.layer}
                data-page-layer
                data-mode={mode}
                onPointerDown={(e) => pressPage(e, index)}
              >
                {items
                  .filter((a) => a.page === index)
                  .map((a) =>
                    a.kind === "text" ? (
                      <TextItem
                        key={a.id}
                        item={a}
                        page={page}
                        selected={selected === a.id}
                        onSelect={() => setSelected(a.id)}
                        onChange={(text) => update(a.id, (x) => ({ ...x, text }) as Annotation)}
                        onEmptyBlur={() => remove(a.id)}
                        onMove={(e) => startMove(e, a)}
                      />
                    ) : (
                      <div
                        key={a.id}
                        className={`${styles.item} ${styles[a.kind]} ${selected === a.id ? styles.selected : ""}`}
                        style={{ left: pct(a.box.x, page.width), top: pct(a.box.y, page.height), width: pct(a.box.w, page.width), height: pct(a.box.h, page.height) }}
                        onPointerDown={(e) => startMove(e, a)}
                      >
                        {a.kind === "image" && <img src={a.src} alt="Signature" className={styles.signature} draggable={false} />}
                        {a.kind === "redact" && <span className={styles.redactLabel}>Redact</span>}
                        {selected === a.id && <span className={styles.resize} onPointerDown={(e) => startResize(e, a)} aria-label="Resize" />}
                      </div>
                    ),
                  )}
                {draft?.page === index && (
                  <div
                    className={`${styles.item} ${styles[draft.mode]}`}
                    style={{ left: pct(draft.box.x, page.width), top: pct(draft.box.y, page.height), width: pct(draft.box.w, page.width), height: pct(draft.box.h, page.height) }}
                  />
                )}
              </div>
            </div>
            <div className={styles.pageNumber}>
              {index + 1} / {pages.length}
            </div>
          </div>
        ))}
      </div>

      {padOpen && (
        <SignaturePad
          onCancel={() => {
            setPadOpen(false);
            if (!signature) setMode("select");
          }}
          onDone={(src, ratio) => {
            setSignature({ src, ratio });
            setPadOpen(false);
            setMode("sign");
          }}
        />
      )}
    </div>
  );
}

/** A text box you type straight into. Its size follows the page (cqw units), so it matches the saved PDF. */
function TextItem({
  item,
  page,
  selected,
  onSelect,
  onChange,
  onEmptyBlur,
  onMove,
}: {
  item: TextAnnotation;
  page: PageInfo;
  selected: boolean;
  onSelect: () => void;
  onChange: (text: string) => void;
  onEmptyBlur: () => void;
  onMove: (e: React.PointerEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // The text is set once; after that the browser owns it while you type (so the cursor never jumps)
  useEffect(() => {
    const el = ref.current!;
    el.innerText = item.text;
    if (!item.text) el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className={`${styles.textItem} ${selected ? styles.selected : ""}`}
      style={{ left: pct(item.x, page.width), top: pct(item.y, page.height) }}
      onPointerDown={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {selected && (
        <span className={styles.moveHandle} onPointerDown={onMove} aria-label="Move text" title="Drag to move">
          ⠿
        </span>
      )}
      <div
        ref={ref}
        className={styles.textContent}
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        aria-label="Text"
        spellCheck={false}
        style={{ fontSize: `${(item.size / page.width) * 100}cqw`, color: item.color }}
        onFocus={onSelect}
        onInput={(e) => onChange((e.currentTarget as HTMLDivElement).innerText.replace(/\n$/, ""))}
        onBlur={(e) => !(e.currentTarget as HTMLDivElement).innerText.trim() && onEmptyBlur()}
      />
    </div>
  );
}
