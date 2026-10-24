"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { User } from "firebase/auth";
import Avatar from "./Avatar";
import { PlanAvatar, PlanPill } from "./PlanBadge";
import { usePlan } from "../lib/plan";
import { signOutUser } from "../lib/auth";
import { useInstall } from "../lib/pwa";
import { getDisplayName, getFirstName } from "../lib/profile";

// Loaded only when the card opens, so pages like the landing page don't pull in Firestore
const StorageMeter = dynamic(() => import("./files/StorageMeter"), { ssr: false });

/** Avatar button that opens a Gmail-style account card. */
export default function ProfileMenu({ user }: { user: User }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const install = useInstall();
  const plan = usePlan();
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
        <PlanAvatar plan={plan}>
          <Avatar user={user} size={36} />
        </PlanAvatar>
      </button>

      {open && (
        <div role="dialog" aria-label="Account" style={styles.card}>
          <div style={styles.email}>{user.email}</div>
          <div style={styles.bigAvatar}>
            <Avatar user={user} size={80} />
          </div>
          <div style={styles.greeting}>Hi, {getFirstName(user)}!</div>
          {user.displayName && <div style={styles.fullName}>{name}</div>}
          <PlanPill plan={plan} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <Link href="/dashboard" style={styles.manageBtn} onClick={() => setOpen(false)}>
              My Space
            </Link>
            <Link href="/vault" style={styles.manageBtn} onClick={() => setOpen(false)}>
              🔐 Secure Vault
            </Link>
          </div>

          <div style={styles.storage}>
            <StorageMeter uid={user.uid} />
          </div>

          {install.kind !== "none" && (
            <button
              style={styles.installBtn}
              onClick={() => (install.kind === "prompt" ? install.install().then(() => setOpen(false)) : setIosHelp((v) => !v))}
            >
              📲 Install the app
            </button>
          )}
          {install.kind === "ios" && iosHelp && (
            <div style={styles.iosHelp}>
              In Safari, tap <b>Share</b> <span aria-hidden>⬆︎</span> then <b>Add to Home Screen</b>.
            </div>
          )}

          <Link href="/account" style={styles.accountLink} onClick={() => setOpen(false)}>
            Manage account
          </Link>

          <button onClick={handleSignOut} style={styles.signOutBtn}>
            Log out
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
  accountLink: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-muted)",
  },
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
  installBtn: {
    marginTop: 14,
    width: "100%",
    padding: "10px",
    background: "transparent",
    color: "var(--primary)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  iosHelp: {
    marginTop: 8,
    fontSize: 13,
    lineHeight: 1.45,
    color: "var(--text-muted)",
    textAlign: "center",
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
