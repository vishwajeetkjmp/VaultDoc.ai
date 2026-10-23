"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../components/AuthProvider";
import { nextFromUrl } from "../../lib/nav";
import AuthShell, { GoogleButton } from "../../components/auth/AuthShell";
import styles from "../../components/auth/auth.module.css";
import { signIn, signInWithGoogle } from "../../lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Once logged in (or if already logged in), go back to the page they came from (home by default)
  useEffect(() => {
    if (!authLoading && user) router.replace(nextFromUrl("/"));
  }, [authLoading, user, router]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  function mapError(code: string): string {
    switch (code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "Incorrect email or password.";
      case "auth/invalid-email":
        return "Please enter a valid email address.";
      case "auth/too-many-requests":
        return "Too many attempts. Try again later.";
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
    setLoading(true);
    try {
      await signIn(email, password);
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
    } catch (err: any) {
      setError(mapError(err?.code ?? ""));
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <AuthShell active="login">
      <form onSubmit={handleSubmit}>
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
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={styles.input}
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} className={styles.showButton}>
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>

        <div className={styles.forgotRow}>
          <Link href="/reset-password" className={styles.link} style={{ fontSize: 13 }}>
            Forgot password?
          </Link>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} className={styles.primaryButton}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <GoogleButton onClick={handleGoogle} loading={googleLoading} />

      <p className={styles.footer}>
        New to VaultDocAI?{" "}
        <Link href="/signup" className={styles.link}>
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
