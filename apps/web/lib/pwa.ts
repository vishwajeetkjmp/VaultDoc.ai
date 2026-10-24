"use client";

import { useEffect, useState } from "react";
import { USE_EMULATORS } from "./firebase";

/**
 * Installing VaultDocAI as an app (PWA): registers public/sw.js on the live site, and remembers the
 * browser's "install" offer so the profile menu can show "Install app". iPhones have no install
 * offer; there the menu explains Share → Add to Home Screen.
 */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function startPwa() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep it for the menu instead of the browser's own mini-bar
    deferred = e as InstallPrompt;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
  // Not in development or on the emulators, so local testing never runs a stale worker
  if (process.env.NODE_ENV === "production" && !USE_EMULATORS) {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }
}

/** Already opened as an installed app */
export const isInstalledApp = () =>
  typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);

/** iPhone or iPad (iPads report themselves as Macs with touch) */
const isIos = () => typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** What the "Install app" item can do here: show the browser's prompt, explain the iPhone steps, or nothing. */
export function useInstall(): { kind: "prompt"; install: () => Promise<void> } | { kind: "ios" } | { kind: "none" } {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  if (isInstalledApp()) return { kind: "none" };
  if (deferred) {
    const prompt = deferred;
    return {
      kind: "prompt",
      install: async () => {
        await prompt.prompt();
        await prompt.userChoice;
        deferred = null;
        notify();
      },
    };
  }
  return isIos() ? { kind: "ios" } : { kind: "none" };
}
