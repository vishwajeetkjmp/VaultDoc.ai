/**
 * Secure Vault cryptography. Everything runs in the browser with Web Crypto;
 * the server only ever stores the outputs of these functions.
 *
 *   recovery key ──(HKDF)──► wraps ─┐
 *   device key (this browser) ──► wraps ─┴─► vault key ──► wraps each file key ──► encrypts file bytes
 *                                              └─────────► encrypts names / types / sizes
 *
 * All encryption is AES-256-GCM, which also detects tampering and wrong keys.
 */

const subtle = () => crypto.subtle;
const IV_BYTES = 12;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const VAULT_KEY_USAGES: KeyUsage[] = ["encrypt", "decrypt", "wrapKey", "unwrapKey"];

// ---------- encoding helpers ----------

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** iv + ciphertext packed into one base64 string, so each value is a single field */
function pack(iv: Uint8Array, data: ArrayBuffer): string {
  const out = new Uint8Array(iv.length + data.byteLength);
  out.set(iv);
  out.set(new Uint8Array(data), iv.length);
  return toBase64(out);
}

function unpack(packed: string) {
  const bytes = fromBase64(packed);
  return { iv: bytes.subarray(0, IV_BYTES), data: bytes.subarray(IV_BYTES) };
}

const newIv = () => crypto.getRandomValues(new Uint8Array(IV_BYTES));

// ---------- keys ----------

export function generateVaultKey(): Promise<CryptoKey> {
  // Extractable only so it can be wrapped for the recovery key and this device
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, VAULT_KEY_USAGES) as Promise<CryptoKey>;
}

/** Wraps (encrypts) one key with another. */
export async function wrapKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const iv = newIv();
  return pack(iv, await subtle().wrapKey("raw", key, wrappingKey, { name: "AES-GCM", iv }));
}

/** Unwraps a key; throws if the wrapping key is wrong. */
export function unwrapKey(
  wrapped: string,
  wrappingKey: CryptoKey,
  { extractable = false, usages = VAULT_KEY_USAGES }: { extractable?: boolean; usages?: KeyUsage[] } = {},
): Promise<CryptoKey> {
  const { iv, data } = unpack(wrapped);
  return subtle().unwrapKey("raw", data, wrappingKey, { name: "AES-GCM", iv }, { name: "AES-GCM", length: 256 }, extractable, usages);
}

// ---------- recovery key ----------

// Crockford base32: no I, L, O, U, so the key is easy to read and type
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const RECOVERY_PREFIX = "VDK1";

function base32(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

function unbase32(text: string): Uint8Array | null {
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of text) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) return null;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/** 256 random bits shown as VDK1-XXXX-XXXX-… */
export function generateRecoveryKey(): { bytes: Uint8Array; text: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const groups = base32(bytes).match(/.{1,4}/g)!;
  return { bytes, text: [RECOVERY_PREFIX, ...groups].join("-") };
}

/** Accepts the key with or without dashes, spaces or lowercase; returns null if malformed. */
export function parseRecoveryKey(text: string): Uint8Array | null {
  const clean = text
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
  if (!clean.startsWith(RECOVERY_PREFIX)) return null;
  const bytes = unbase32(clean.slice(RECOVERY_PREFIX.length));
  return bytes && bytes.length >= 32 ? bytes.subarray(0, 32) : null;
}

/** Turns the recovery key into the AES key that wraps the vault key. */
export async function recoveryWrappingKey(recovery: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const base = await subtle().importKey("raw", recovery, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("vaultdoc-recovery-v1") },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

// ---------- data ----------

export async function encryptBytes(key: CryptoKey, data: BufferSource): Promise<Uint8Array> {
  const iv = newIv();
  return fromBase64(pack(iv, await subtle().encrypt({ name: "AES-GCM", iv }, key, data)));
}

export async function decryptBytes(key: CryptoKey, packed: Uint8Array): Promise<ArrayBuffer> {
  return subtle().decrypt({ name: "AES-GCM", iv: packed.subarray(0, IV_BYTES) }, key, packed.subarray(IV_BYTES));
}

export async function encryptJson(key: CryptoKey, value: unknown): Promise<string> {
  return toBase64(await encryptBytes(key, enc.encode(JSON.stringify(value))));
}

export async function decryptJson<T>(key: CryptoKey, b64: string): Promise<T> {
  return JSON.parse(dec.decode(await decryptBytes(key, fromBase64(b64)))) as T;
}

/** A fresh key for one file, extractable so it can be wrapped by the vault key. */
export function generateFileKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]) as Promise<CryptoKey>;
}
