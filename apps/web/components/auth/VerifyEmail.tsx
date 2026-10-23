"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import AuthShell from "./AuthShell";
import styles from "./auth.module.css";
import { refreshVerification, sendVerificationEmail, signOutUser } from "../../lib/auth";

const RESEND_WAIT_S = 60;

/** Shown instead of protected pages until an email/password account clicks its verification link. */
export default function VerifyEmail({ user }: { user: User }) {
  const [message, setMessage] = useState("");
  const [checking, setChecking] = useState(false);
  const [wait, setWait] = useState(RESEND_WAIT_S);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  // Coming back to this tab after clicking the link checks automatically
  useEffect(() => {
    const onFocus = () => refreshVerification(user).catch(() => {});
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [user]);

  const check = async () => {
    setChecking(true);
    setMessage("");
    try {
      const ok = await refreshVerification(user);
      if (!ok) setMessage("Not verified yet. Click the link in the email, then try again.");
    } catch {
      setMessage("Couldn't check right now. Try again.");
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setMessage("");
    try {
      await sendVerificationEmail(user);
      setWait(RESEND_WAIT_S);
      setMessage("Sent. Check your inbox and spam folder.");
    } catch {
      setMessage("Couldn't send right now. Wait a minute and try again.");
    }
  };

  return (
    <AuthShell active={null}>
      <h2 className={styles.title} style={{ fontSize: 18, textAlign: "center", marginTop: 18 }}>
        📧 Verify your email
      </h2>
      <p className={styles.subtitle} style={{ textAlign: "center", fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
        We sent a verification link to <b>{user.email}</b>. Click it to activate your account, then come back here.
      </p>
      {message && (
        <p className={styles.subtitle} style={{ textAlign: "center", fontSize: 13, marginTop: 12 }} role="status">
          {message}
        </p>
      )}
      <button className={styles.primaryButton} onClick={check} disabled={checking}>
        {checking ? "Checking…" : "I've verified, continue"}
      </button>
      <p className={styles.footer}>
        Didn&apos;t get it?{" "}
        <button
          className={styles.link}
          onClick={resend}
          disabled={wait > 0}
          style={{ border: 0, background: "none", padding: 0, opacity: wait > 0 ? 0.6 : 1 }}
        >
          {wait > 0 ? `Resend in ${wait}s` : "Resend email"}
        </button>
        {" · "}
        <button
          className={styles.link}
          onClick={() => signOutUser().then(() => (window.location.href = "/"))}
          style={{ border: 0, background: "none", padding: 0 }}
        >
          Log out
        </button>
      </p>
    </AuthShell>
  );
}
