"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logo}>D</div>
        <h1 style={styles.title}>VaultDocAI</h1>
        <p style={styles.subtitle}>AI-powered analysis for your documents</p>

        <div style={styles.tabs}>
          <Link href="/signin" style={{ ...styles.tab, ...styles.tabInactive }}>
            Sign in
          </Link>
          <div style={{ ...styles.tab, ...styles.tabActive }}>Create account</div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={styles.label}>Full name</label>
          <input
            type="text"
            placeholder="Your name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={styles.input}
          />

          <label style={styles.label}>Email address</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />

          <label style={styles.label}>Password</label>
          <div style={styles.passwordWrap}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{ ...styles.input, marginBottom: 0, paddingRight: 64 }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              style={styles.showBtn}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          <label style={styles.label}>Confirm password</label>
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Re-enter your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.primaryBtn}>
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerLine} />
          <span style={styles.dividerText}>OR</span>
          <span style={styles.dividerLine} />
        </div>

        <button
          onClick={handleGoogle}
          disabled={googleLoading}
          style={styles.googleBtn}
        >
          <GoogleIcon />
          {googleLoading ? "Connecting..." : "Continue with Google"}
        </button>

        <p style={styles.footer}>
          Already have an account?{" "}
          <Link href="/signin" style={styles.footerLink}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 10 }}>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.4 5.4 2.5 13.3l7.8 6.1C12.2 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.5c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.9-9.9 6.9-17.3z" />
      <path fill="#FBBC05" d="M10.3 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.5 10.7l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.3-5.7c-2 1.4-4.7 2.3-8 2.3-6.4 0-11.8-3.8-13.7-9.1l-7.8 6.1C6.4 42.6 14.6 48 24 48z" />
    </svg>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0a0e1a",
    padding: 24,
    fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 440,
    background: "#0d1220",
    border: "1px solid #1c2740",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: "linear-gradient(135deg,#2563eb,#38bdf8)",
    color: "#fff",
    fontSize: 26,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    margin: "0 auto 16px",
  },
  title: { color: "#fff", fontSize: 26, fontWeight: 700, textAlign: "center", margin: 0 },
  subtitle: { color: "#8b97b0", fontSize: 14, textAlign: "center", margin: "8px 0 24px" },
  tabs: {
    display: "flex",
    background: "#111a2e",
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    textAlign: "center",
    padding: "10px 0",
    borderRadius: 8,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    textDecoration: "none",
  },
  tabActive: { background: "#fff", color: "#2563eb" },
  tabInactive: { color: "#8b97b0" },
  label: { display: "block", color: "#c7d0e0", fontSize: 14, fontWeight: 600, margin: "16px 0 8px" },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "14px 16px",
    background: "#111a2e",
    border: "1px solid #1c2740",
    borderRadius: 10,
    color: "#fff",
    fontSize: 15,
    marginBottom: 4,
    outline: "none",
  },
  passwordWrap: { position: "relative" },
  showBtn: {
    position: "absolute",
    right: 14,
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    color: "#6d8cff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    background: "rgba(239,68,68,0.1)",
    border: "1px solid rgba(239,68,68,0.3)",
    color: "#fca5a5",
    fontSize: 14,
    padding: "10px 14px",
    borderRadius: 8,
    margin: "8px 0",
  },
  primaryBtn: {
    width: "100%",
    padding: 14,
    background: "#6d5cff",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 700,
    cursor: "pointer",
    marginTop: 16,
  },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "24px 0" },
  dividerLine: { flex: 1, height: 1, background: "#1c2740" },
  dividerText: { color: "#8b97b0", fontSize: 13, fontWeight: 600 },
  googleBtn: {
    width: "100%",
    padding: 14,
    background: "#fff",
    color: "#1f2937",
    border: "none",
    borderRadius: 10,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { color: "#8b97b0", fontSize: 14, textAlign: "center", marginTop: 24 },
  footerLink: { color: "#6d8cff", fontWeight: 600, textDecoration: "none" },
};