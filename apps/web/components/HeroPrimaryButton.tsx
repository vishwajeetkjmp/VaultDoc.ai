"use client";

import { useAuth } from "./AuthProvider";

/**
 * "Get started free" for visitors, "Go to My Files" for signed-in users.
 * Hidden (but keeping its space) until Firebase reports the sign-in state,
 * so the wrong label never flashes.
 */
export default function HeroPrimaryButton({ style }: { style: React.CSSProperties }) {
  const { user, loading } = useAuth();
  const signedIn = !!user;
  return (
    <a
      href={signedIn ? "/dashboard" : "/signup"}
      style={{ ...style, visibility: loading ? "hidden" : "visible" }}
      aria-hidden={loading || undefined}
    >
      {signedIn ? "Go to My Files" : "Get started free"}
    </a>
  );
}
