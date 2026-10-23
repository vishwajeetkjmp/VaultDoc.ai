"use client";

import { useEffect, useRef, useState } from "react";

export const AUTO_LOCK_MS = 60_000;

/**
 * Calls `onLock` after `timeoutMs` without pointer, keyboard, touch or scroll
 * activity. Uses timestamps (not a single timer) so a backgrounded tab still
 * locks as soon as it's looked at again. Returns seconds left, for a countdown.
 */
export function useIdleLock(onLock: () => void, timeoutMs = AUTO_LOCK_MS) {
  const last = useRef(Date.now());
  const lockRef = useRef(onLock);
  lockRef.current = onLock;
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(timeoutMs / 1000));

  useEffect(() => {
    const touch = () => (last.current = Date.now());
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];
    events.forEach((e) => window.addEventListener(e, touch, { capture: true, passive: true }));

    const check = () => {
      const left = timeoutMs - (Date.now() - last.current);
      if (left <= 0) lockRef.current();
      else setSecondsLeft(Math.ceil(left / 1000));
    };
    const timer = setInterval(check, 1000);
    document.addEventListener("visibilitychange", check);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }));
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, [timeoutMs]);

  return secondsLeft;
}
