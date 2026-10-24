"use client";

import { useEffect } from "react";
import { startPwa } from "../lib/pwa";

/** Starts the app-install support once per page load (see lib/pwa.ts). */
export default function PwaStart() {
  useEffect(() => startPwa(), []);
  return null;
}
