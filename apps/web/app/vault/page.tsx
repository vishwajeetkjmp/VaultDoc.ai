"use client";

import { useAuth, RequireAuth } from "../../components/AuthProvider";
import VaultApp from "../../components/vault/VaultApp";

export default function VaultPage() {
  return (
    <RequireAuth>
      <Vault />
    </RequireAuth>
  );
}

function Vault() {
  const { user } = useAuth();
  return user ? <VaultApp user={user} /> : null;
}
