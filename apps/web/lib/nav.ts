"use client";

import { useEffect, useState } from "react";

/** Only paths on this site, so a ?next= link can't send people to another website. */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : fallback;
}

/** "/login?next=/pricing": after logging in, people go back to the page they were on. */
export function withNext(path: "/login" | "/signup", next?: string | null): string {
  const target = safeNext(next, "");
  return target && target !== "/" && target !== path ? `${path}?next=${encodeURIComponent(target)}` : path;
}

/** The current page's ?next= value. Read after mount, since static pages can't read the URL while rendering. */
export function useNextParam(): string | null {
  const [next, setNext] = useState<string | null>(null);
  useEffect(() => setNext(new URLSearchParams(window.location.search).get("next")), []);
  return next;
}

/** Where to go once logged in: the ?next= page, or `fallback`. */
export function nextFromUrl(fallback = "/"): string {
  return safeNext(new URLSearchParams(window.location.search).get("next"), fallback);
}
