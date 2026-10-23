"use client";

import { useEffect } from "react";

/** Starts crash reporting once the page is idle, so it never slows the first load. */
export default function ErrorReporter() {
  useEffect(() => {
    const start = () => import("../lib/ops/errorReporter").then((m) => m.startErrorReporting());
    const idle = (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback;
    if (idle) idle(start);
    else setTimeout(start, 2000);
  }, []);
  return null;
}
