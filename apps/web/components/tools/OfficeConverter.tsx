"use client";

import { useCallback, useRef, useState } from "react";
import { formatBytes } from "../../lib/files/format";
import { convertWordToPdf } from "../../lib/tools/office";
import Dropzone from "./Dropzone";
import ResultCard from "./ResultCard";
import styles from "./tools.module.css";

const WORD = /\.(docx?|DOCX?)$/;

/** Word (.docx / .doc) → PDF via the server converter. */
export default function OfficeConverter({ accept, acceptLabel }: { accept: string; acceptLabel: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ blob: Blob; name: string } | null>(null);
  const abort = useRef<AbortController | null>(null);

  const pick = useCallback((files: File[]) => {
    const f = files[0];
    if (!f) return;
    setError("");
    if (!WORD.test(f.name)) {
      setError("Please choose a Word document (.docx or .doc).");
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError(`This file is ${formatBytes(f.size)}. The limit is 20 MB.`);
      return;
    }
    setFile(f);
  }, []);

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const blob = await convertWordToPdf(file, abort.current.signal);
      setResult({ blob, name: file.name.replace(/\.[^.]+$/, "") + ".pdf" });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError(e instanceof Error ? e.message : "Conversion failed.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return (
      <ResultCard
        blob={result.blob}
        fileName={result.name}
        onReset={() => {
          setResult(null);
          setFile(null);
        }}
      />
    );
  }

  if (!file) {
    return (
      <>
        <Dropzone accept={accept} acceptLabel={acceptLabel} multiple={false} onFiles={pick} />
        {error && <p className={styles.error}>{error}</p>}
      </>
    );
  }

  return (
    <>
      <div className={styles.options}>
        <div className={styles.option} style={{ flex: 1 }}>
          📄 {file.name}
          <span className={styles.muted} style={{ fontWeight: 400 }}>
            {formatBytes(file.size)} · sent securely, converted, then deleted right away
          </span>
        </div>
        {!busy && (
          <button className={styles.secondary} onClick={() => setFile(null)}>
            Choose another file
          </button>
        )}
        {busy && (
          <button className={styles.secondary} onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      <div className={styles.actionsRow}>
        <span className={styles.muted}>{busy ? "Converting… this usually takes a few seconds" : "Ready to convert"}</span>
        <button className={styles.primary} onClick={convert} disabled={busy}>
          {busy ? (
            <>
              <span className={styles.spinner} /> Converting…
            </>
          ) : (
            "Convert to PDF"
          )}
        </button>
      </div>
    </>
  );
}
