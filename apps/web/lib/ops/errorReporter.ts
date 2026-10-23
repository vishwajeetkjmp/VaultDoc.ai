import { EMULATOR_PROJECT_ID, USE_EMULATORS } from "../firebase";

/**
 * Sends website crashes to Cloud Error Reporting (via the reportClientError function).
 * About 1 KB, started after the page is idle, at most 5 reports per page load, and noise from
 * browser extensions or cross-site scripts is ignored. Nothing about the user is sent.
 */
const ENDPOINT = USE_EMULATORS
  ? `http://127.0.0.1:5001/${EMULATOR_PROJECT_ID}/asia-south2/reportClientError`
  : `https://asia-south2-${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.cloudfunctions.net/reportClientError`;
const IGNORE = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:|safari-extension:|Loading chunk|ChunkLoadError/i;

let started = false;

export function startErrorReporting() {
  if (started || typeof window === "undefined" || !navigator.sendBeacon) return;
  started = true;
  const seen = new Set<string>();
  const send = (message: string, stack?: string) => {
    const key = message.slice(0, 120);
    if (seen.size >= 5 || seen.has(key) || IGNORE.test(message) || IGNORE.test(stack ?? "")) return;
    seen.add(key);
    const body = JSON.stringify({ message, stack, url: location.origin + location.pathname, release: process.env.NEXT_PUBLIC_RELEASE ?? "web" });
    navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "text/plain" }));
  };
  window.addEventListener("error", (e) => send(e.message || String(e.error), e.error?.stack));
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as { message?: string; stack?: string } | undefined;
    send(r?.message ?? String(e.reason), r?.stack);
  });
}
