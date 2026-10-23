"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";

/**
 * "Get started free" for visitors, "Go to My Space" for logged-in users.
 * Hidden (but keeping its space) until Firebase reports the login state,
 * so the wrong label never flashes.
 */
export default function HeroPrimaryButton({ style, className }: { style?: React.CSSProperties; className?: string }) {
  const { user, loading } = useAuth();
  const loggedIn = !!user;
  return (
    <Link
      href={loggedIn ? "/dashboard" : "/signup"}
      className={className}
      style={{ ...style, visibility: loading ? "hidden" : "visible" }}
      aria-hidden={loading || undefined}
    >
      {loggedIn ? "Go to My Space" : "Get started free"}
    </Link>
  );
}
