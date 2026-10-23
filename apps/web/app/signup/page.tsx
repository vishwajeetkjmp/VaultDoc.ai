"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import AuthShell, { GoogleButton } from "../../components/auth/AuthShell";
import styles from "../../components/auth/auth.module.css";
import { signUp, signInWithGoogle } from "../../lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function mapError(code: string): string {
    switch (code) {
      case "auth/email-already-in-use":
        return "An account with this email already exists.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/weak-password":
        return "Password is too weak (min 6 characters).";
      case "auth/popup-closed-by-user":
        return "Google sign-in was cancelled.";
      case "auth/unauthorized-domain":
        return "This domain isn't authorized in Firebase.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email, password, name);
      router.push("/dashboard");
    } catch (err: any) {
      setError(mapError(err?.code ?? ""));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setGoogleLoading(true);
    try {
      await signInWithGoogle();
      router.push("/dashboard");
    } catch (err: any) {
      setError(mapError(err?.code ?? ""));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell active="signup">
      <form onSubmit={handleSubmit}>
        <label className={styles.label} htmlFor="name">
          Full name
        </label>
        <input
          id="name"
          type="text"
          autoComplete="name"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={styles.input}
        />

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
          className={styles.input}
        />

        <label className={styles.label} htmlFor="password">
          Password
        </label>
        <div className={styles.passwordWrap}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="Create a password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className={styles.showButton}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <label className={styles.label} htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className={styles.input}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} className={styles.primaryButton}>
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className={styles.footer}>
        Already have an account?{" "}
        <Link href="/signin" className={styles.link}>
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
