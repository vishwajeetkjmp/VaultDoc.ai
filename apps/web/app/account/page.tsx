"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { User } from "firebase/auth";
import { RequireAuth, useAuth } from "../../components/AuthProvider";
import Avatar from "../../components/Avatar";
import SitePage from "../../components/SitePage";
import StorageMeter from "../../components/files/StorageMeter";
import styles from "../../components/site.module.css";
import { confirmIdentity, deleteMyAccount, usesGoogle, usesPassword } from "../../lib/account";
import { getDisplayName } from "../../lib/profile";

const AiSetting = dynamic(() => import("../../components/files/AiSetting"), { ssr: false });
const PlanSummary = dynamic(() => import("../../components/files/PlanSummary"), { ssr: false });

export default function AccountPage() {
  return (
    // Unverified accounts can still reach this page, e.g. to delete a mistaken sign-up
    <RequireAuth allowUnverified>
      <Account />
    </RequireAuth>
  );
}

function Account() {
  const { user } = useAuth();
  if (!user) return null;
  const methods = [usesGoogle(user) && "Google", usesPassword(user) && "Email and password"].filter(Boolean).join(", ");

  return (
    <SitePage>
      <span className={styles.eyebrow}>Account</span>
      <h1 className={styles.title} style={{ fontSize: 32 }}>
        Manage your account
      </h1>

      <section className={styles.section}>
        <div className={styles.card} style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
          <Avatar user={user} size={64} />
          <div style={{ minWidth: 0 }}>
            <div className={styles.cardTitle} style={{ marginTop: 0, fontSize: 18 }}>
              {getDisplayName(user)}
            </div>
            <div className={styles.cardText} style={{ marginTop: 2 }}>
              {user.email} {user.emailVerified ? "· ✅ verified" : "· ⚠️ not verified"}
            </div>
            <div className={styles.cardText} style={{ marginTop: 2 }}>
              Sign-in: {methods || "—"}
            </div>
          </div>
        </div>
      </section>

      {user.emailVerified && (
        <section className={styles.section}>
          <h2 className={styles.h2}>Plan</h2>
          <div className={styles.card}>
            <PlanSummary uid={user.uid} />
          </div>
        </section>
      )}

      {user.emailVerified && (
        <section className={styles.section}>
          <h2 className={styles.h2}>Storage</h2>
          <div className={styles.card}>
            <StorageMeter uid={user.uid} />
          </div>
        </section>
      )}

      {user.emailVerified && (
        <section className={styles.section}>
          <h2 className={styles.h2}>AI</h2>
          <AiSetting uid={user.uid} />
        </section>
      )}

      <section className={styles.section}>
        <h2 className={styles.h2}>Delete account</h2>
        <DeleteAccount user={user} />
      </section>
    </SitePage>
  );
}

function DeleteAccount({ user }: { user: User }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const needsPassword = usesPassword(user);

  const danger = "#e5484d";
  const input: React.CSSProperties = {
    width: "100%",
    marginTop: 10,
    padding: "11px 14px",
    borderRadius: 10,
    border: "1px solid var(--border)",
    background: "var(--bg)",
    color: "var(--text)",
    fontSize: 15,
  };

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await confirmIdentity(user, password);
    } catch (e: any) {
      setBusy(false);
      const code = e?.code ?? e?.message;
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") setError("Incorrect password.");
      else if (code === "auth/popup-closed-by-user") setError("Google confirmation was cancelled.");
      else if (code === "auth/user-mismatch") setError("Please confirm with the same Google account.");
      else setError("Couldn't confirm it's you. Try again.");
      return;
    }
    try {
      await deleteMyAccount(user);
      window.location.href = "/?accountDeleted=1";
    } catch {
      setBusy(false);
      setError("Deleting failed. Nothing was removed if this was the first error; please try again.");
    }
  };

  if (!open) {
    return (
      <div className={styles.card} style={{ borderColor: `color-mix(in srgb, ${danger} 40%, var(--border))` }}>
        <p className={styles.cardText} style={{ marginTop: 0 }}>
          Permanently delete your VaultDocAI account and everything stored in it.
        </p>
        <button
          onClick={() => setOpen(true)}
          style={{ marginTop: 14, padding: "10px 16px", borderRadius: 10, border: `1px solid ${danger}`, background: "transparent", color: danger, fontWeight: 700 }}
        >
          Delete account…
        </button>
      </div>
    );
  }

  return (
    <div className={styles.card} style={{ borderColor: danger }}>
      <div className={styles.cardTitle} style={{ marginTop: 0, color: danger }}>
        This can&apos;t be undone
      </div>
      <ul className={styles.list} style={{ marginTop: 8 }}>
        <li>All files and folders in My Space</li>
        <li>Your Secure Vault and everything in it</li>
        <li>Your storage records and your sign-in account</li>
      </ul>
      <p className={styles.cardText}>Download anything you want to keep first.</p>

      {needsPassword && (
        <input
          type="password"
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={input}
          aria-label="Your password"
        />
      )}
      <input
        placeholder='Type "DELETE" to confirm'
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        style={input}
        aria-label="Type DELETE to confirm"
      />
      {!needsPassword && (
        <p className={styles.cardText} style={{ fontSize: 13 }}>
          You&apos;ll be asked to log in with Google once more to confirm it&apos;s you.
        </p>
      )}
      {error && (
        <p className={styles.cardText} style={{ color: danger }} role="alert">
          {error}
        </p>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
        <button
          onClick={run}
          disabled={busy || typed !== "DELETE" || (needsPassword && !password)}
          style={{
            padding: "11px 18px",
            borderRadius: 10,
            border: 0,
            background: danger,
            color: "#fff",
            fontWeight: 700,
            opacity: busy || typed !== "DELETE" || (needsPassword && !password) ? 0.5 : 1,
          }}
        >
          {busy ? "Deleting…" : "Delete my account permanently"}
        </button>
        <button onClick={() => setOpen(false)} disabled={busy} className={styles.buttonGhost} style={{ padding: "11px 18px" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
