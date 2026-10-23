"use client";

import { useEffect, useState } from "react";
import { enrollDevice, LOCKOUT_AFTER, lockoutUntil, setNewPin, unlockWithPin, WIPE_AFTER } from "../../lib/vault/device";
import { sendPinResetEmail } from "../../lib/vault/emailReset";
import { createVault, eraseVault, openWithRecoveryKey } from "../../lib/vault/store";
import PinInput from "./PinInput";
import styles from "./vault.module.css";

function Frame({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <a href="/dashboard" className={styles.backLink}>
        ← My Files
      </a>
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden>
          {icon}
        </div>
        <h1 className={styles.title}>{title}</h1>
        {children}
      </div>
    </div>
  );
}

/** Enter a new PIN twice. `forbidden` rejects reusing the current PIN. */
function NewPin({ title, intro, onDone, forbidden }: { title: string; intro: string; onDone: (pin: string) => Promise<void>; forbidden?: string }) {
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);

  const handle = async (pin: string) => {
    if (first === null) {
      if (forbidden && pin === forbidden) {
        setError("Choose a different PIN from your current one.");
        setReset((r) => r + 1);
        return;
      }
      if (/^(\d)\1{5}$/.test(pin) || "0123456789".includes(pin) || "9876543210".includes(pin)) {
        setError("That PIN is too easy to guess. Avoid repeated or sequential digits.");
        setReset((r) => r + 1);
        return;
      }
      setError("");
      setFirst(pin);
      setReset((r) => r + 1);
      return;
    }
    if (pin !== first) {
      setError("The PINs didn't match. Start again.");
      setFirst(null);
      setReset((r) => r + 1);
      return;
    }
    setBusy(true);
    try {
      await onDone(pin);
    } catch {
      setError("Something went wrong. Try again.");
      setBusy(false);
      setFirst(null);
      setReset((r) => r + 1);
    }
  };

  return (
    <Frame icon="🔢" title={title}>
      <p className={styles.text}>{first === null ? intro : "Enter the same PIN again to confirm."}</p>
      <PinInput label={first === null ? "New PIN" : "Confirm new PIN"} onComplete={handle} resetKey={reset} error={!!error} disabled={busy} />
      {error && <p className={styles.error}>{error}</p>}
    </Frame>
  );
}

// ---------- First-time setup ----------

export function SetupFlow({ uid, onOpen }: { uid: string; onOpen: (vaultKey: CryptoKey) => void }) {
  const [step, setStep] = useState<"intro" | "key" | "confirm" | "pin">("intro");
  const [vault, setVault] = useState<Awaited<ReturnType<typeof createVault>> | null>(null);
  const [saved, setSaved] = useState(false);
  const [typed, setTyped] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const lastGroup = vault?.recoveryText.split("-").pop() ?? "";

  if (step === "intro") {
    return (
      <Frame icon="🔐" title="Set up your Secure Vault">
        <p className={styles.text}>
          Files in the vault are encrypted on your device before upload. Nobody else can open them, including the
          VaultDoc team.
        </p>
        <ul className={styles.list}>
          <li><span>🔑</span><span>You'll get a <b>recovery key</b> to open the vault on a new device.</span></li>
          <li><span>🔢</span><span>You'll choose a <b>6-digit PIN</b> for everyday unlocking on this device.</span></li>
          <li><span>⏱️</span><span>It <b>locks itself</b> after 60 seconds without activity.</span></li>
          <li><span>🔄</span><span>You'll set a <b>new PIN every 6 days</b>.</span></li>
        </ul>
        <button
          className={styles.primary}
          onClick={async () => {
            setVault(await createVault(uid));
            setStep("key");
          }}
        >
          Create my vault
        </button>
      </Frame>
    );
  }

  if (step === "key" && vault) {
    const download = () => {
      const text = `VaultDoc Secure Vault — recovery key\n\n${vault.recoveryText}\n\nKeep this somewhere safe and private.\nYou need it to open your vault on a new device.\nIf you lose it and your devices, nobody can recover your vault.\n`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
      a.download = "VaultDoc-recovery-key.txt";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    return (
      <Frame icon="🔑" title="Save your recovery key">
        <p className={styles.text}>This is the only way to open your vault on a new phone or computer.</p>
        <div className={styles.keyBox}>{vault.recoveryText.replace(/-/g, " ")}</div>
        <div className={styles.keyActions}>
          <button
            className={styles.secondary}
            onClick={() => navigator.clipboard.writeText(vault.recoveryText).then(() => setCopied(true))}
          >
            {copied ? "Copied ✓" : "Copy"}
          </button>
          <button className={styles.secondary} onClick={download}>
            Download
          </button>
          <button className={styles.secondary} onClick={() => window.print()}>
            Print
          </button>
        </div>
        <div className={styles.warn}>
          ⚠️ <b>We can't recover this for you.</b> We never see your recovery key. If you lose it and every device you've
          set up, your vault can't be opened by anyone.
        </div>
        <label className={styles.check}>
          <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
          I've saved my recovery key somewhere safe
        </label>
        <button className={styles.primary} disabled={!saved} onClick={() => setStep("confirm")}>
          Continue
        </button>
      </Frame>
    );
  }

  if (step === "confirm" && vault) {
    return (
      <Frame icon="✅" title="Check your recovery key">
        <p className={styles.text}>
          Type the <b>last 4 characters</b> of your recovery key, to make sure you have it.
        </p>
        <input
          className={`${styles.input} ${styles.mono}`}
          value={typed}
          maxLength={8}
          autoFocus
          placeholder="XXXX"
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          style={{ textAlign: "center", letterSpacing: "0.3em" }}
        />
        {error && <p className={styles.error}>{error}</p>}
        <button
          className={styles.primary}
          disabled={typed.trim().length < lastGroup.length}
          onClick={() => {
            if (typed.trim() !== lastGroup) return setError("That doesn't match. Check your saved key.");
            setError("");
            setStep("pin");
          }}
        >
          Confirm
        </button>
        <div className={styles.links}>
          <button className={styles.linkButton} onClick={() => setStep("key")}>
            Show the key again
          </button>
        </div>
      </Frame>
    );
  }

  if (step === "pin" && vault) {
    return (
      <NewPin
        title="Choose a 6-digit PIN"
        intro="You'll use it to unlock the vault on this device."
        onDone={async (pin) => {
          await vault.save();
          await enrollDevice(uid, vault.vaultKey, pin);
          onOpen(vault.vaultKey);
        }}
      />
    );
  }
  return null;
}

// ---------- Unlock (and the 6-day PIN change) ----------

export function UnlockScreen({
  uid,
  email,
  onOpen,
  onNeedRecovery,
}: {
  uid: string;
  email: string | null;
  onOpen: (vaultKey: CryptoKey) => void;
  onNeedRecovery: () => void;
}) {
  const [error, setError] = useState("");
  const [reset, setReset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [rotate, setRotate] = useState<{ key: CryptoKey; currentPin: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    lockoutUntil(uid).then(setLockedUntil);
  }, [uid]);
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const locked = lockedUntil > now;

  if (rotate) {
    return (
      <NewPin
        title="Time for a new PIN"
        intro="It's been 6 days since you set your PIN. Choose a new 6-digit PIN to continue."
        forbidden={rotate.currentPin}
        onDone={async (pin) => {
          await setNewPin(uid, pin);
          onOpen(rotate.key);
        }}
      />
    );
  }

  const handle = async (pin: string) => {
    setBusy(true);
    const result = await unlockWithPin(uid, pin);
    setBusy(false);
    if (result.ok) {
      if (result.mustChangePin) setRotate({ key: result.vaultKey, currentPin: pin });
      else onOpen(result.vaultKey);
      return;
    }
    setReset((r) => r + 1);
    if (result.reason === "wrong") setError(`Wrong PIN. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left before a pause.`);
    else if (result.reason === "locked") {
      setLockedUntil(result.until);
      setNow(Date.now());
      setError("");
    } else onNeedRecovery(); // too many wrong PINs, or this device was forgotten
  };

  const mins = Math.ceil((lockedUntil - now) / 60000);
  return (
    <Frame icon="🔒" title="Secure Vault is locked">
      <p className={styles.text}>{locked ? "Too many wrong PINs." : "Enter your 6-digit PIN."}</p>
      {locked ? (
        <div className={styles.warn}>
          Try again in <b>{mins} minute{mins === 1 ? "" : "s"}</b>. After {WIPE_AFTER} wrong PINs in total, you'll need
          your recovery key.
        </div>
      ) : (
        <PinInput label="PIN" onComplete={handle} resetKey={reset} error={!!error} disabled={busy} />
      )}
      {error && !locked && <p className={styles.error}>{error}</p>}
      <div className={styles.links}>
        {email && (
          <button
            className={styles.linkButton}
            disabled={emailSent}
            onClick={() =>
              sendPinResetEmail(email)
                .then(() => setEmailSent(true))
                .catch(() => setError("Couldn't send the email. Try again later."))
            }
          >
            {emailSent ? `Link sent to ${email}` : "Forgot PIN?"}
          </button>
        )}
        <button className={styles.linkButton} onClick={onNeedRecovery}>
          Use recovery key
        </button>
      </div>
      {emailSent && (
        <p className={styles.text} style={{ fontSize: 12.5 }}>
          Open the link on this device to set a new PIN. It works only where your vault is already set up.
        </p>
      )}
      <p className={styles.text} style={{ fontSize: 12 }}>
        {LOCKOUT_AFTER} wrong PINs pause unlocking for 15 minutes.
      </p>
    </Frame>
  );
}

// ---------- New device / lost PIN: recovery key ----------

export function RecoveryFlow({ uid, onOpen, onErased }: { uid: string; onOpen: (vaultKey: CryptoKey) => void; onErased: () => void }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [erasing, setErasing] = useState(false);
  const [confirmErase, setConfirmErase] = useState("");

  if (key) {
    return (
      <NewPin
        title="Choose a PIN for this device"
        intro="Recovery key accepted. Choose a 6-digit PIN for everyday unlocking here."
        onDone={async (pin) => {
          await enrollDevice(uid, key, pin);
          onOpen(key);
        }}
      />
    );
  }

  if (erasing) {
    return (
      <Frame icon="⚠️" title="Erase your vault?">
        <p className={styles.text}>
          Without the recovery key, nobody can open the files in your vault. You can erase it and start a new, empty
          vault. <b>All vault files will be permanently deleted.</b>
        </p>
        <input className={styles.input} placeholder='Type "ERASE" to confirm' value={confirmErase} onChange={(e) => setConfirmErase(e.target.value)} />
        <button
          className={styles.primary}
          style={{ background: "#e5484d" }}
          disabled={confirmErase !== "ERASE" || busy}
          onClick={async () => {
            setBusy(true);
            await eraseVault(uid);
            onErased();
          }}
        >
          Erase vault permanently
        </button>
        <div className={styles.links}>
          <button className={styles.linkButton} onClick={() => setErasing(false)}>
            Cancel
          </button>
        </div>
      </Frame>
    );
  }

  return (
    <Frame icon="🔑" title="Enter your recovery key">
      <p className={styles.text}>This device isn't set up for your vault yet, or needs to be set up again.</p>
      <textarea
        className={`${styles.input} ${styles.mono}`}
        rows={3}
        placeholder="VDK1-XXXX-XXXX-…"
        value={text}
        autoFocus
        onChange={(e) => setText(e.target.value)}
        style={{ resize: "none" }}
      />
      {error && <p className={styles.error}>{error}</p>}
      <button
        className={styles.primary}
        disabled={busy || text.trim().length < 20}
        onClick={async () => {
          setBusy(true);
          setError("");
          const vaultKey = await openWithRecoveryKey(uid, text);
          setBusy(false);
          if (vaultKey) setKey(vaultKey);
          else setError("That recovery key doesn't open this vault. Check it and try again.");
        }}
      >
        {busy ? "Checking…" : "Unlock vault"}
      </button>
      <div className={styles.links}>
        <button className={styles.linkButton} onClick={() => setErasing(true)}>
          Lost your recovery key?
        </button>
      </div>
    </Frame>
  );
}

// ---------- Forgot PIN: after the email link ----------

export function EmailResetFlow({ uid, onDone }: { uid: string; onDone: () => void }) {
  return (
    <NewPin
      title="Set a new PIN"
      intro="Your email is confirmed. Choose a new 6-digit PIN for this device."
      onDone={async (pin) => {
        await setNewPin(uid, pin);
        onDone();
      }}
    />
  );
}

export function GateMessage({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <Frame icon={icon} title={title}>
      <p className={styles.text}>{text}</p>
    </Frame>
  );
}
