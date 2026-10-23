"use client";

import { GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, type User } from "firebase/auth";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApi, errorText, type Role } from "../lib/api";
import { auth, USE_EMULATORS } from "../lib/firebase";

type Who = { role: Role | null; email: string; google: boolean; canClaimOwner: boolean };
type State =
  | { status: "loading" }
  | { status: "signedOut"; error?: string }
  | { status: "noAccess"; user: User; who: Who; error?: string }
  | { status: "ready"; user: User; role: Role };

type Ctx = {
  user: User;
  role: Role;
  toast: (message: string, bad?: boolean) => void;
  logout: () => void;
};
const AdminContext = createContext<Ctx | null>(null);

export function useAdmin(): Ctx {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin outside AdminProvider");
  return ctx;
}

/** Lets only admins in. Google login; the role comes from a fresh token so changes apply immediately. */
export default function AdminProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [toast, setToast] = useState<{ message: string; bad?: boolean } | null>(null);

  const check = useCallback(async (user: User) => {
    try {
      await user.getIdToken(true); // pick up a role that was just granted or removed
      const who = await adminApi<Who>("whoami");
      setState(who.role && who.google ? { status: "ready", user, role: who.role } : { status: "noAccess", user, who });
    } catch (e) {
      setState({ status: "signedOut", error: errorText(e) });
    }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => (u ? check(u) : setState({ status: "signedOut" }))), [check]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") setState({ status: "signedOut", error: errorText(e) });
    }
  };
  const logout = useCallback(() => void signOut(auth), []);
  const showToast = useCallback((message: string, bad?: boolean) => setToast({ message, bad }), []);

  const ctx = useMemo<Ctx | null>(
    () => (state.status === "ready" ? { user: state.user, role: state.role, toast: showToast, logout } : null),
    [state, showToast, logout],
  );

  let body: React.ReactNode;
  if (state.status === "loading") {
    body = (
      <div className="center">
        <div className="skeleton" style={{ width: 220, height: 14 }} />
      </div>
    );
  } else if (state.status === "signedOut") {
    body = (
      <div className="center">
        <div className="card loginCard">
          <div className="brandMark" style={{ margin: "0 auto", width: 44, height: 44, fontSize: 20 }}>
            🔒
          </div>
          <div>
            <h1 style={{ fontSize: 20 }}>VaultDoc Admin</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              For the VaultDoc team. Log in with your Google account.
            </p>
          </div>
          <button className="google" onClick={login}>
            <GoogleG /> Continue with Google
          </button>
          {state.error && <p className="badge bad" style={{ justifySelf: "center", height: "auto", padding: "6px 10px" }}>{state.error}</p>}
          {USE_EMULATORS && <TestLogin />}
          <p className="muted small">Every action here is recorded in the audit log.</p>
        </div>
      </div>
    );
  } else if (state.status === "noAccess") {
    body = <NoAccess user={state.user} who={state.who} onClaimed={() => check(state.user)} onLogout={logout} />;
  } else {
    body = <AdminContext.Provider value={ctx}>{children}</AdminContext.Provider>;
  }

  return (
    <>
      {body}
      {toast && (
        <div className={`toast${toast.bad ? " bad" : ""}`} role="status">
          {toast.message}
        </div>
      )}
    </>
  );
}

function NoAccess({ user, who, onClaimed, onLogout }: { user: User; who: Who; onClaimed: () => void; onLogout: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const claim = async () => {
    setBusy(true);
    setError("");
    try {
      await adminApi("claimOwner");
      onClaimed();
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };
  return (
    <div className="center">
      <div className="card loginCard">
        <h1 style={{ fontSize: 20 }}>{who.canClaimOwner ? "Set up the admin panel" : "No admin access"}</h1>
        <p className="muted">
          {who.canClaimOwner
            ? `${user.email} is the configured owner. Claim the Owner role to start; you can add your team afterwards.`
            : who.role && !who.google
              ? "Admins must log in with Google. Log out and use “Continue with Google”."
              : `${user.email} doesn't have an admin role. Ask the owner to add you on the Team page.`}
        </p>
        {error && <p className="badge bad" style={{ justifySelf: "center", height: "auto", padding: "6px 10px" }}>{error}</p>}
        <div className="row" style={{ justifyContent: "center" }}>
          {who.canClaimOwner && (
            <button className="btn btnPrimary" onClick={claim} disabled={busy}>
              {busy ? "Setting up…" : "Become Owner"}
            </button>
          )}
          <button className="btn" onClick={onLogout}>
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}

/** Local test mode only: log in as a seeded test account (the server allows this only on the emulators). */
function TestLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form
      className="grid"
      style={{ gap: 8, paddingTop: 12, borderTop: "1px dashed var(--border)" }}
      onSubmit={(e) => {
        e.preventDefault();
        signInWithEmailAndPassword(auth, email, password).catch(() => alert("Test login failed"));
      }}
    >
      <span className="badge warn" style={{ justifySelf: "center" }}>
        Local test mode
      </span>
      <input className="input" placeholder="test email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Test email" />
      <input className="input" type="password" placeholder="password" value={password} onChange={(e) => setPassword(e.target.value)} aria-label="Test password" />
      <button className="btn" type="submit">
        Test login
      </button>
    </form>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-2.9-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.4 2.3-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}
