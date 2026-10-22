"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { User } from "firebase/auth";
import Avatar from "./Avatar";
import { signOutUser } from "../lib/auth";
import { getDisplayName, getFirstName } from "../lib/profile";

// Loaded only when the card opens, so pages like the landing page don't pull in Firestore
const StorageMeter = dynamic(() => import("./files/StorageMeter"), { ssr: false });

/** Avatar button that opens a Gmail-style account card. */
export default function ProfileMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    await signOutUser();
    router.replace("/");
  }

  const name = getDisplayName(user);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Account: ${name}`}
        aria-expanded={open}
        title={`${name}\n${user.email ?? ""}`}
        style={{
          ...styles.trigger,
          boxShadow: open ? "0 0 0 3px rgba(138,180,248,0.5)" : "none",
        }}
      >
        <Avatar user={user} size={36} />
      </button>

      {open && (
        <div role="dialog" aria-label="Account" style={styles.card}>
          <div style={styles.email}>{user.email}</div>
          <div style={styles.bigAvatar}>
            <Avatar user={user} size={80} />
          </div>
          <div style={styles.greeting}>Hi, {getFirstName(user)}!</div>
          {user.displayName && <div style={styles.fullName}>{name}</div>}

          <a href="/dashboard" style={styles.manageBtn} onClick={() => setOpen(false)}>
            Go to My Files
          </a>

          <div style={styles.storage}>
            <StorageMeter uid={user.uid} />
          </div>

          <button onClick={handleSignOut} style={styles.signOutBtn}>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  trigger: {
    padding: 0,
    border: "none",
    background: "transparent",
    borderRadius: "50%",
    display: "flex",
    transition: "box-shadow 0.15s ease",
  },
  card: {
    position: "absolute",
    top: "calc(100% + 10px)",
    right: 0,
    width: 320,
    maxWidth: "calc(100vw - 32px)",
    background: "var(--card)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 24,
    padding: "20px 16px 16px",
    boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
    zIndex: 200,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  email: {
    fontSize: 14,
    fontWeight: 500,
    color: "var(--text-muted)",
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  bigAvatar: { margin: "18px 0 10px" },
  greeting: { fontSize: 22, fontWeight: 400 },
  fullName: { fontSize: 14, color: "var(--text-muted)", marginTop: 2 },
  storage: {
    width: "100%",
    marginTop: 16,
    padding: "14px 16px",
    border: "1px solid var(--border)",
    borderRadius: 16,
  },
  manageBtn: {
    marginTop: 16,
    padding: "8px 22px",
    border: "1px solid var(--border)",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 500,
    color: "var(--primary)",
  },
  signOutBtn: {
    marginTop: 16,
    width: "100%",
    padding: "12px",
    background: "var(--bg)",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 500,
  },
};
