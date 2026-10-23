import "./setup";
import { createHash } from "node:crypto";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { defineString } from "firebase-functions/params";
import { logger } from "firebase-functions/v2";
import { onRequest } from "firebase-functions/v2/https";
import { GoogleAuth } from "google-auth-library";
import { bumpDaily } from "./stats";

/**
 * Word (.docx / .doc) → PDF for the free tools.
 *
 * Only for logged-in users with a verified email (the browser sends their
 * Firebase ID token). The browser POSTs the file; this function checks it,
 * rate-limits the account, and passes it to a private Gotenberg (LibreOffice) service on
 * Cloud Run, which only this function can call. The document is held in
 * memory only and never stored.
 */
const GOTENBERG_URL = defineString("GOTENBERG_URL", { description: "Base URL of the private Gotenberg Cloud Run service" });

const MAX_BYTES = 20 * 1024 * 1024;
const PER_HOUR = 10;

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://vaultdoc-ai.web.app",
  "https://vaultdoc-ai.firebaseapp.com",
];

// .docx files are ZIP archives; .doc files are OLE compound documents
const looksLikeDocx = (b: Buffer) => b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
const looksLikeDoc = (b: Buffer) => b.length > 8 && b.readUInt32BE(0) === 0xd0cf11e0 && b.readUInt32BE(4) === 0xa1b11ae1;

const auth = new GoogleAuth();

/** Calls the converter, with a Google identity token when it's the private Cloud Run service. */
async function converterFetch(path: string, init: RequestInit = {}) {
  const url = GOTENBERG_URL.value().replace(/\/$/, "");
  const headers: Record<string, string> = url.startsWith("https://")
    ? Object.fromEntries((await (await auth.getIdTokenClient(url)).getRequestHeaders()).entries())
    : {};
  return fetch(`${url}${path}`, { ...init, headers: { ...headers, ...(init.headers as Record<string, string>) } });
}

/** For the admin System page: is the converter up, and how fast does it answer? */
export async function converterHealth(): Promise<{ ok: boolean; ms: number; detail?: string }> {
  const started = Date.now();
  try {
    const res = await converterFetch("/health", { signal: AbortSignal.timeout(15_000) });
    return { ok: res.ok, ms: Date.now() - started, detail: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, ms: Date.now() - started, detail: e instanceof Error ? e.message : String(e) };
  }
}

export const RATE_LIMIT_PER_HOUR = PER_HOUR;
/** Clears this hour's conversion count for one user (admin "reset limit"). */
export async function resetConvertLimit(uid: string) {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = createHash("sha256").update(`vaultdoc-convert:${uid}`).digest("hex").slice(0, 32);
  await getFirestore().doc(`toolRateLimits/${key}_${hour}`).delete();
}
/** This hour's conversions for one user. */
export async function convertUsage(uid: string): Promise<number> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = createHash("sha256").update(`vaultdoc-convert:${uid}`).digest("hex").slice(0, 32);
  return Number((await getFirestore().doc(`toolRateLimits/${key}_${hour}`).get()).get("count")) || 0;
}

/** Allows PER_HOUR conversions per account per hour. Accounts are stored as a hash, not the raw user id. */
async function withinLimit(uid: string): Promise<boolean> {
  const hour = Math.floor(Date.now() / 3_600_000);
  const key = createHash("sha256").update(`vaultdoc-convert:${uid}`).digest("hex").slice(0, 32);
  const ref = getFirestore().doc(`toolRateLimits/${key}_${hour}`);
  return getFirestore().runTransaction(async (tx) => {
    const count = Number((await tx.get(ref)).get("count")) || 0;
    if (count >= PER_HOUR) return false;
    tx.set(
      ref,
      // expireAt lets a Firestore TTL policy clean these up automatically; uid lets admins spot abuse
      { count: FieldValue.increment(1), expireAt: Timestamp.fromMillis((hour + 2) * 3_600_000), uid, kind: "convert" },
      { merge: true },
    );
    return true;
  });
}

export const convertDocument = onRequest(
  { cors: ALLOWED_ORIGINS, memory: "512MiB", timeoutSeconds: 120, maxInstances: 5, concurrency: 20 },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Use POST." });
      return;
    }
    const token = String(req.headers.authorization ?? "").match(/^Bearer (.+)$/)?.[1];
    const user = token ? await getAuth().verifyIdToken(token).catch(() => null) : null;
    if (!user) {
      res.status(401).json({ error: "Please log in to use this tool." });
      return;
    }
    if (!user.email_verified) {
      res.status(403).json({ error: "Please verify your email to use this tool." });
      return;
    }
    const body = req.rawBody;
    if (!body?.length) {
      res.status(400).json({ error: "No file received." });
      return;
    }
    if (body.length > MAX_BYTES) {
      res.status(413).json({ error: "File is larger than 20 MB." });
      return;
    }
    const isDocx = looksLikeDocx(body);
    if (!isDocx && !looksLikeDoc(body)) {
      res.status(415).json({ error: "That doesn't look like a Word document (.docx or .doc)." });
      return;
    }

    if (!(await withinLimit(user.uid))) {
      res.status(429).json({ error: `You've reached ${PER_HOUR} conversions this hour. Please try again later.` });
      return;
    }

    // Keep a readable base name, but never trust it for anything else
    const raw = decodeURIComponent(String(req.headers["x-file-name"] ?? "document"));
    const base = raw.replace(/\.[^.]+$/, "").replace(/[^\w\- .()]+/g, "_").slice(0, 80) || "document";
    const fileName = `${base}.${isDocx ? "docx" : "doc"}`;

    try {
      const form = new FormData();
      form.append("files", new Blob([body]), fileName);
      const out = await converterFetch("/forms/libreoffice/convert", { method: "POST", body: form });
      if (!out.ok) {
        logger.warn("Converter error", { status: out.status, body: (await out.text()).slice(0, 300) });
        res.status(502).json({ error: "This document couldn't be converted. It may be damaged or password-protected." });
        return;
      }
      const pdf = Buffer.from(await out.arrayBuffer());
      await bumpDaily({ conversions: 1 });
      res.set("Content-Type", "application/pdf");
      res.set("Content-Disposition", `attachment; filename="${base}.pdf"`);
      res.set("Cache-Control", "no-store");
      res.status(200).send(pdf);
    } catch (e) {
      logger.error("Conversion failed", e);
      res.status(500).json({ error: "The converter is busy or unavailable. Please try again in a minute." });
    }
  },
);
