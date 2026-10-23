"use client";

import { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import AuthShell from "../../components/auth/AuthShell";
import styles from "../../components/auth/auth.module.css";
import { auth } from "../../lib/firebase";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim(), { url: `${window.location.origin}/signin` });
      setSent(true);
    } catch (err: any) {
      if (err?.code === "auth/invalid-email") setError("Please enter a valid email address.");
      else if (err?.code === "auth/too-many-requests") setError("Too many requests. Try again later.");
      // Any other outcome (including an unknown email) shows the same message,
      // so this page can't be used to find out who has an account.
      else setSent(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell active={null}>
      <h2 className={styles.title} style={{ fontSize: 18, textAlign: "center", marginTop: 18 }}>
        Reset your password
      </h2>
      {sent ? (
        <>
          <p className={styles.subtitle} style={{ textAlign: "center", fontSize: 14, marginTop: 10 }}>
            If an account exists for <b>{email.trim()}</b>, we&apos;ve sent a link to reset the password. Check your
            inbox and spam folder.
          </p>
          <Link href="/signin" className={styles.primaryButton} style={{ display: "block", textAlign: "center" }}>
            Back to sign in
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit}>
          <p className={styles.subtitle} style={{ textAlign: "center", fontSize: 14, marginTop: 6 }}>
            Enter your email and we&apos;ll send you a link to choose a new password.
          </p>
          <label className={styles.label} htmlFor="email">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className={styles.input}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} className={styles.primaryButton}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <p className={styles.footer}>
        Remembered it?{" "}
        <Link href="/signin" className={styles.link}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
