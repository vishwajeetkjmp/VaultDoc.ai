"use client";

import { Component, ReactNode, useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import RobotVaultSvg from "./RobotVaultSvg";
import { HERO_ANIMATION_HEIGHT, HERO_ANIMATION_OPACITY } from "./timeline";

// Separate chunk: only desktops that pass canUse3D() ever download Three.js
const RobotVault3D = dynamic(() => import("./RobotVault3D"), { ssr: false });

/** Desktop with a mouse, WebGL, no reduced-motion or data-saver preference. */
function canUse3D(): boolean {
  // ?hero=svg or ?hero=3d forces a version, handy for testing
  const forced = new URLSearchParams(window.location.search).get("hero");
  if (forced === "svg") return false;
  const desktop = window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
  if (forced !== "3d" && (!desktop || reducedMotion || saveData)) return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Falls back to the SVG if the 3D scene throws while rendering. */
class FallbackOnError extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function HeroBackground() {
  // The SVG renders first (also on the server), so there's never an empty hero
  const [use3D, setUse3D] = useState(false);
  const [ready3D, setReady3D] = useState(false);

  useEffect(() => {
    if (!canUse3D()) return;
    // Wait until the browser is idle so the 3D download never competes with the page itself
    const start = () => setUse3D(true);
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 300);
    return () => clearTimeout(id);
  }, []);

  const handleReady = useCallback(() => setReady3D(true), []);
  const handleError = useCallback(() => {
    setUse3D(false);
    setReady3D(false);
  }, []);

  return (
    // Fills whatever box the hero gives it (all of the hero on laptops, one row on phones), strip centred
    <div
      aria-hidden
      style={{
        position: "relative",
        height: "100%",
        display: "flex",
        alignItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: HERO_ANIMATION_HEIGHT,
          opacity: HERO_ANIMATION_OPACITY,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            overflow: "hidden",
            containerType: "size",
            opacity: ready3D ? 0 : 1,
            transition: "opacity 0.6s ease",
          }}
        >
          <RobotVaultSvg />
        </div>

        {use3D && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: ready3D ? 1 : 0,
              transition: "opacity 0.6s ease",
            }}
          >
            <FallbackOnError onError={handleError}>
              <RobotVault3D onReady={handleReady} onError={handleError} />
            </FallbackOnError>
          </div>
        )}
      </div>
    </div>
  );
}
