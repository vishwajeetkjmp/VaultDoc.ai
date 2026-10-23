/**
 * What this browser remembers about a user's vault, in IndexedDB:
 * the vault key wrapped by a non-extractable device key, and a salted hash of
 * the PIN. Nothing here is sent to the server.
 *
 * The PIN guards everyday access on this device. The protection against the
 * server (and the app owner) is the encryption itself: the vault key never
 * leaves the user's devices unencrypted.
 */
import { fromBase64, toBase64, unwrapKey, wrapKey } from "./crypto";

export const PIN_LENGTH = 6;
export const PIN_MAX_AGE_MS = 6 * 24 * 60 * 60 * 1000; // new PIN required every 6 days
export const LOCKOUT_AFTER = 5; // wrong PINs before a pause
export const LOCKOUT_MS = 15 * 60 * 1000;
export const WIPE_AFTER = 10; // wrong PINs before the recovery key is required

type DeviceRecord = {
  uid: string;
  deviceKey: CryptoKey; // non-extractable: can be used here but never exported
  wrappedVaultKey: string;
  pinHash: string;
  pinSalt: string;
  pinSetAt: number;
  failedAttempts: number;
  lockedUntil: number;
};

// ---------- tiny IndexedDB wrapper ----------

const DB_NAME = "vaultdoc-vault";
const STORE = "devices";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "uid" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

const getRecord = (uid: string) => run<DeviceRecord | undefined>("readonly", (s) => s.get(uid));
const putRecord = (rec: DeviceRecord) => run<void>("readwrite", (s) => s.put(rec));
export const forgetDevice = (uid: string) => run<void>("readwrite", (s) => s.delete(uid));

export async function hasDevice(uid: string): Promise<boolean> {
  return !!(await getRecord(uid));
}

// ---------- PIN ----------

export function isValidPin(pin: string) {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

async function hashPin(pin: string, salt: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 310_000 }, base, 256);
  return toBase64(new Uint8Array(bits));
}

function sameString(a: string, b: string) {
  // Compare without stopping at the first difference
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

async function newPinFields(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { pinHash: await hashPin(pin, salt), pinSalt: toBase64(salt), pinSetAt: Date.now(), failedAttempts: 0, lockedUntil: 0 };
}

/** Remembers the vault on this device, unlocked by `pin`. `vaultKey` must be extractable. */
export async function enrollDevice(uid: string, vaultKey: CryptoKey, pin: string) {
  const deviceKey = (await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
    "wrapKey",
    "unwrapKey",
  ])) as CryptoKey;
  await putRecord({ uid, deviceKey, wrappedVaultKey: await wrapKey(vaultKey, deviceKey), ...(await newPinFields(pin)) });
}

export type UnlockResult =
  | { ok: true; vaultKey: CryptoKey; mustChangePin: boolean }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "locked"; until: number }
  | { ok: false; reason: "wiped" }
  | { ok: false; reason: "no-device" };

export async function lockoutUntil(uid: string): Promise<number> {
  const rec = await getRecord(uid);
  return rec && rec.lockedUntil > Date.now() ? rec.lockedUntil : 0;
}

export async function unlockWithPin(uid: string, pin: string): Promise<UnlockResult> {
  const rec = await getRecord(uid);
  if (!rec) return { ok: false, reason: "no-device" };
  if (rec.lockedUntil > Date.now()) return { ok: false, reason: "locked", until: rec.lockedUntil };

  const matches = sameString(await hashPin(pin, fromBase64(rec.pinSalt)), rec.pinHash);
  if (!matches) {
    const failed = rec.failedAttempts + 1;
    if (failed >= WIPE_AFTER) {
      await forgetDevice(uid);
      return { ok: false, reason: "wiped" };
    }
    const lockedUntil = failed % LOCKOUT_AFTER === 0 ? Date.now() + LOCKOUT_MS : 0;
    await putRecord({ ...rec, failedAttempts: failed, lockedUntil });
    if (lockedUntil) return { ok: false, reason: "locked", until: lockedUntil };
    return { ok: false, reason: "wrong", attemptsLeft: LOCKOUT_AFTER - (failed % LOCKOUT_AFTER) };
  }

  await putRecord({ ...rec, failedAttempts: 0, lockedUntil: 0 });
  const vaultKey = await unwrapKey(rec.wrappedVaultKey, rec.deviceKey);
  return { ok: true, vaultKey, mustChangePin: Date.now() - rec.pinSetAt > PIN_MAX_AGE_MS };
}

/** Sets a new PIN. Callers must have verified the current PIN (or the email link) first. */
export async function setNewPin(uid: string, pin: string) {
  const rec = await getRecord(uid);
  if (!rec) throw new Error("This device isn't set up for the vault");
  await putRecord({ ...rec, ...(await newPinFields(pin)) });
}

