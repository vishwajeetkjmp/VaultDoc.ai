"use client";

import { useCallback, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { forgetDevice, hasDevice } from "../../lib/vault/device";
import { completePinReset, isPinResetLink } from "../../lib/vault/emailReset";
import { vaultExists } from "../../lib/vault/store";
import VaultBrowser from "./VaultBrowser";
import { EmailResetFlow, GateMessage, RecoveryFlow, SetupFlow, UnlockScreen } from "./VaultGate";

type Screen = "loading" | "setup" | "unlock" | "recover" | "reset" | "reset-failed" | "open";

/** Decides which vault screen to show and holds the vault key while unlocked. */
export default function VaultApp({ user }: { user: User }) {
  const uid = user.uid;
  const [screen, setScreen] = useState<Screen>("loading");
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);

  const decide = useCallback(async () => {
    const [exists, onDevice] = await Promise.all([vaultExists(uid), hasDevice(uid)]);
    if (!exists) {
      if (onDevice) await forgetDevice(uid); // vault was erased elsewhere
      setScreen("setup");
    } else if (!onDevice) {
      setScreen("recover");
    } else if (isPinResetLink()) {
      const verified = await completePinReset(uid);
      window.history.replaceState(null, "", "/vault");
      setScreen(verified ? "reset" : "reset-failed");
    } else {
      setScreen("unlock");
    }
  }, [uid]);

  useEffect(() => {
    decide();
  }, [decide]);

  const openVault = (key: CryptoKey) => {
    setVaultKey(key);
    setScreen("open");
  };

  const lock = useCallback(() => {
    setVaultKey(null); // the only copy of the unlocked key; the browser can now discard it
    setScreen("unlock");
  }, []);

  switch (screen) {
    case "loading":
      return <GateMessage icon="🔐" title="Secure Vault" text="Loading…" />;
    case "setup":
      return <SetupFlow uid={uid} onOpen={openVault} />;
    case "recover":
      return <RecoveryFlow uid={uid} onOpen={openVault} onErased={() => setScreen("setup")} />;
    case "reset":
      return <EmailResetFlow uid={uid} onDone={() => setScreen("unlock")} />;
    case "reset-failed":
      return (
        <GateMessage
          icon="⚠️"
          title="Link didn't work"
          text="This PIN reset link is invalid, expired, or was opened on a different device or account. Request a new one from the unlock screen."
        />
      );
    case "unlock":
      return <UnlockScreen uid={uid} email={user.email} onOpen={openVault} onNeedRecovery={() => setScreen("recover")} />;
    case "open":
      return vaultKey ? <VaultBrowser user={user} vaultKey={vaultKey} onLock={lock} /> : null;
  }
}
