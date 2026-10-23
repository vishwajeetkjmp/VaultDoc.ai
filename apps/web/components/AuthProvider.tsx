"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { isSigningOut, onAuthChange } from "../lib/auth";
import type { User } from "firebase/auth";
import VerifyEmail from "./auth/VerifyEmail";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Firebase keeps the same User object when it changes (e.g. email verified), so count updates to re-render
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setVersion((v) => v + 1);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const value = useMemo(() => ({ user, loading }), [user, loading, version]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Wrap any page that requires login. Redirects to /signin if not authenticated, and asks
// email/password accounts to verify their email first (unless allowUnverified).
export function RequireAuth({ children, allowUnverified }: { children: React.ReactNode; allowUnverified?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // After signing out, ProfileMenu sends the user to the landing page instead
    if (!loading && !user && !isSigningOut()) {
      router.replace("/signin");
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