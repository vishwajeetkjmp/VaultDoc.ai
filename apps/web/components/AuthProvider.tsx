"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isSigningOut, onAuthChange } from "../lib/auth";
import { withNext } from "../lib/nav";
import type { User } from "firebase/auth";
import VerifyEmail from "./auth/VerifyEmail";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  /** Whether this browser was logged in last time, known before Firebase finishes checking. Lets the navbar hold the right space. */
  wasLoggedIn: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  wasLoggedIn: false,
});

const LOGGED_IN_HINT = "vaultdocai-logged-in";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Firebase keeps the same User object when it changes (e.g. email verified), so count updates to re-render
  const [version, setVersion] = useState(0);
  const [wasLoggedIn, setWasLoggedIn] = useState(false);

  useEffect(() => {
    try {
      setWasLoggedIn(localStorage.getItem(LOGGED_IN_HINT) === "1");
    } catch {}
    const unsub = onAuthChange((u) => {
      setUser(u);
      setVersion((v) => v + 1);
      setLoading(false);
      try {
        if (u) localStorage.setItem(LOGGED_IN_HINT, "1");
        else localStorage.removeItem(LOGGED_IN_HINT);
      } catch {}
    });
    return () => unsub();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ user, loading, wasLoggedIn }), [user, loading, wasLoggedIn, version]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Wrap any page that requires login. Sends visitors to /login (and back here afterwards), and asks
// email/password accounts to verify their email first (unless allowUnverified).
export function RequireAuth({ children, allowUnverified }: { children: React.ReactNode; allowUnverified?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // After signing out, ProfileMenu sends the user to the landing page instead
    if (!loading && !user && !isSigningOut()) {
      router.replace(withNext("/login", window.location.pathname + window.location.search));
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            border: "4px solid var(--border)",
            borderTopColor: "var(--primary)",
            animation: "spin 0.8s linear infinite",
          }}
        />
      </div>
    );
  }

  if (!user.emailVerified && !allowUnverified) return <VerifyEmail user={user} />;

  return <>{children}</>;
}