"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../AuthProvider";
import { formatBytes } from "../../lib/files/format";
import { withNext } from "../../lib/nav";
import { WORD_TRIAL_PER_DAY } from "../../lib/toolPages";
import { convertWordToPdf, trialUsedToday } from "../../lib/tools/office";
import Dropzone from "./Dropzone";
import ResultCard from "./ResultCard";
import styles from "./tools.module.css";

const WORD = /\.(docx?|DOCX?)$/;

/**
 * Word (.docx / .doc) → PDF via the server converter. With `trial` (Word to PDF), visitors without an
 * account can convert WORD_TRIAL_PER_DAY .docx files a day; then they're asked to log in (free).
 */
export default function OfficeConverter({ accept, acceptLabel, trial = false }: { accept: string; acceptLabel: string; trial?: boolean }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const visitor = trial && !loading && !user;
  const [used, setUsed] = useState(0);
  useEffect(() => setUsed(trialUsedToday()), []);
  const left = Math.max(0, WORD_TRIAL_PER_DAY - used);
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
    if (visitor && !/\.docx$/i.test(f.name)) {
      setError("Older .doc files need a free account. Log in, then use DOC to PDF.");
      return;
    }
    setFile(f);
  }, [visitor]);

  const convert = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    abort.current = new AbortController();
    try {
      const blob = await convertWordToPdf(file, abort.current.signal);
      setResult({ blob, name: file.name.replace(/\.[^.]+$/, "") + ".pdf" });
      setUsed(trialUsedToday());
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

  // Today's free conversions are used up: ask the visitor to log in (it stays free)
  if (visitor && left === 0) {
    return (
      <div className={styles.result}>
        <div className={styles.resultIcon} style={{ background: "color-mix(in srgb, var(--primary) 16%, transparent)", color: "var(--primary)" }} aria-hidden>
          🔒
        </div>
        <div className={styles.resultTitle}>You&apos;ve used today&apos;s {WORD_TRIAL_PER_DAY} free conversions</div>
        <p className={styles.muted} style={{ maxWidth: 440, textAlign: "center", margin: 0 }}>
          Log in to keep converting. It&apos;s still free, takes a minute, and needs no card.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <Link href={withNext("/login", pathname)} className={styles.primary}>
            Login
          </Link>
          <Link href={withNext("/signup", pathname)} className={styles.secondary} style={{ height: 46 }}>
            Create free account
          </Link>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <>
        <Dropzone accept={accept} acceptLabel={acceptLabel} multiple={false} onFiles={pick} />
        {error && <p className={styles.error}>{error}</p>}
        {visitor && (
          <p className={styles.muted} style={{ marginTop: 10, textAlign: "center" }}>
            {left} of {WORD_TRIAL_PER_DAY} free conversions left today ·{" "}
            <Link href={withNext("/login", pathname)} style={{ textDecoration: "underline" }}>
              Log in
            </Link>{" "}
            for more, free
          </p>
        )}
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
