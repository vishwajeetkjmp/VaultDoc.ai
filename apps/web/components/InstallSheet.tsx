"use client";

import { useEffect, useState } from "react";
import { useInstall } from "../lib/pwa";
import styles from "./installSheet.module.css";

const DISMISSED_KEY = "vaultdoc-install-dismissed";
const HIDE_FOR_MS = 30 * 86_400_000;
const DELAY_MS = 5000;

/** A phone, as far as layout is concerned (the sheet is never shown on laptops). */
const isPhone = () => window.matchMedia("(max-width: 760px) and (pointer: coarse)").matches;

function dismissedRecently() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < HIDE_FOR_MS;
  } catch {
    return false;
  }
}

/**
 * Home page on phones only: after a few seconds, a sheet slides up offering the app (installable
 * PWA). Not now / ✕ hides it for 30 days and says where to find it later. Never on tool pages, so
 * visitors arriving from search aren't interrupted.
 */
export default function InstallSheet() {
  const install = useInstall();
  const [open, setOpen] = useState(false);
  const [iosSteps, setIosSteps] = useState(false);
  const [toast, setToast] = useState(false);
  const available = install.kind !== "none";

  useEffect(() => {
    if (!available || !isPhone() || dismissedRecently()) return;
    const timer = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, [available]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(false), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      // Private browsing: it may show again next visit
    }
    setOpen(false);
    setToast(true);
  }

  async function installNow() {
    if (install.kind === "prompt") {
      await install.install();
      setOpen(false);
    } else if (install.kind === "ios") {
      setIosSteps(true);
    }
  }

  return (
    <>
      {open && (
        <div className={styles.backdrop} onPointerDown={(e) => e.target === e.currentTarget && dismiss()}>
          <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="install-title">
            <button type="button" className={styles.close} onClick={dismiss} aria-label="Close">
              ✕
            </button>
            <img src="/icons/icon-192.png" alt="" width={56} height={56} className={styles.icon} />
            <div id="install-title" className={styles.title}>
              Get the VaultDocAI app
            </div>
            <p className={styles.text}>Open your documents in one tap from your home screen, full screen and faster.</p>
            {iosSteps ? (
              <p className={styles.steps}>
                In Safari, tap <b>Share</b> <span aria-hidden>⬆︎</span> then <b>Add to Home Screen</b>.
              </p>
            ) : (
              <button type="button" className={styles.install} onClick={installNow}>
                Install the app
              </button>
            )}
            <button type="button" className={styles.later} onClick={dismiss}>
              Not now
            </button>
          </div>
        </div>
      )}
      {toast && (
        <div className={styles.toast} role="status">
          You can install the app anytime from the ☰ menu.
        </div>
      )}
    </>
  );
}
