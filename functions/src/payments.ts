import "./setup";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { defineSecret, defineString } from "firebase-functions/params";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { PRO_PRICE, setPlan } from "./plans";
import { bumpDaily } from "./stats";

/**
 * Buying Pro with Razorpay (UPI, cards, netbanking). One-time payments: each one adds 30 days of Pro.
 *
 *   1. createProOrder  the app asks for an order; Razorpay gets the amount from us, never from the browser
 *   2. Razorpay Checkout runs in the browser; the person pays
 *   3. verifyProPayment  checks Razorpay's signature AND asks Razorpay that the payment really succeeded,
 *      then adds 30 days of Pro
 *   4. razorpayWebhook  Razorpay tells us directly too, so Pro starts even if the browser closed mid-way
 * Steps 3 and 4 may both arrive; a payment is only ever counted once.
 *
 *   users/{uid}/payments/{orderId}  status created → paid, amount (paise), paymentId, periodEnd (owner can read)
 *
 * Keys: RAZORPAY_KEY_ID (functions/.env.<project>, public) and the secrets RAZORPAY_KEY_SECRET and
 * RAZORPAY_WEBHOOK_SECRET (Secret Manager). Test keys (rzp_test_…) take no real money.
 * On the emulators PAYMENTS_FAKE=true skips Razorpay entirely.
 */
const RAZORPAY_KEY_ID = defineString("RAZORPAY_KEY_ID", { default: "" });
const RAZORPAY_KEY_SECRET = defineSecret("RAZORPAY_KEY_SECRET");
const RAZORPAY_WEBHOOK_SECRET = defineSecret("RAZORPAY_WEBHOOK_SECRET");
const API = "https://api.razorpay.com/v1";
const FAKE = () => process.env.PAYMENTS_FAKE === "true";
export const FAKE_SIGNATURE = "fake-signature-emulator";
const DAY = 86_400_000;

const db = () => getFirestore();
const paymentRef = (uid: string, orderId: string) => db().doc(`users/${uid}/payments/${orderId}`);

async function razorpay<T>(path: string, init: { method?: string; body?: object } = {}): Promise<T> {
  const auth = Buffer.from(`${RAZORPAY_KEY_ID.value()}:${RAZORPAY_KEY_SECRET.value()}`).toString("base64");
  const res = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
  if (!res.ok) {
    logger.error("Razorpay request failed", { path, status: res.status, error: data.error?.description });
    throw new HttpsError("unavailable", "The payment service didn't respond. Please try again in a minute.");
  }
  return data;
}

/** Equal strings, compared in constant time (signatures). */
function sameSignature(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function verifiedUser(request: { auth?: { uid: string; token: { email_verified?: boolean; email?: string; name?: string } } }) {
  if (!request.auth) throw new HttpsError("unauthenticated", "Please log in first.");
  if (!request.auth.token.email_verified) throw new HttpsError("failed-precondition", "Please verify your email first.");
  return request.auth;
}

/** Step 1: a ₹399 order for 30 days of Pro. */
export const createProOrder = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  const auth = verifiedUser(request);
  const { amount, days } = PRO_PRICE;
  const receipt = `pro_${Date.now().toString(36)}_${randomBytes(3).toString("hex")}`;
  const order = FAKE()
    ? { id: `order_fake_${randomBytes(6).toString("hex")}` }
    : await razorpay<{ id: string }>("/orders", {
        method: "POST",
        body: { amount, currency: "INR", receipt, notes: { uid: auth.uid, plan: "pro", days: String(days) } },
      });
  await paymentRef(auth.uid, order.id).set({
    orderId: order.id,
    plan: "pro",
    days,
    amount,
    currency: "INR",
    status: "created",
    createdAt: FieldValue.serverTimestamp(),
  });
  return {
    orderId: order.id,
    keyId: FAKE() ? "rzp_test_fake" : RAZORPAY_KEY_ID.value(),
    amount,
    currency: "INR",
    email: auth.token.email ?? "",
    name: auth.token.name ?? "",
  };
});

/**
 * Marks an order paid and adds 30 days of Pro (from today, or from the end of current Pro). Safe to call
 * more than once: the payment is recorded once, and Pro is applied once.
 */
async function completePayment(uid: string, orderId: string, payment: { id: string; amount: number; method?: string }, via: string) {
  const ref = paymentRef(uid, orderId);
  const result = await db().runTransaction(async (tx) => {
    const [record, user] = await Promise.all([tx.get(ref), tx.get(db().doc(`users/${uid}`))]);
    if (!record.exists) throw new HttpsError("not-found", "We couldn't find this order.");
    if (record.get("planApplied") === true) return null; // already done
    if (payment.amount !== record.get("amount")) throw new HttpsError("failed-precondition", "The paid amount doesn't match the order.");
    if (record.get("status") === "paid") return { periodEnd: record.get("periodEnd") as Timestamp | null, amount: payment.amount, first: false };

    // Pro granted by an admin with no end date stays unlimited; otherwise 30 more days from the later of now and the current end
    const until = user.get("plan") === "pro" ? (user.get("planUntil") as Timestamp | undefined) : undefined;
    const unlimited = user.get("plan") === "pro" && !until;
    const start = Math.max(Date.now(), until?.toMillis() ?? 0);
    const periodEnd = unlimited ? null : Timestamp.fromMillis(start + Number(record.get("days")) * DAY);
    tx.update(ref, { status: "paid", paymentId: payment.id, method: payment.method ?? null, via, paidAt: FieldValue.serverTimestamp(), periodEnd });
    return { periodEnd, amount: payment.amount, first: true };
  });
  if (!result) return;
  await setPlan(uid, "pro", result.periodEnd ? result.periodEnd.toMillis() : null, "payment");
  await ref.update({ planApplied: true });
  if (result.first) await bumpDaily({ payments: 1, revenuePaise: result.amount });
  logger.info("Pro payment applied", { uid, orderId, via });
}

/** Step 3: the browser reports a payment; check it with Razorpay before trusting it. */
export const verifyProPayment = onCall({ secrets: [RAZORPAY_KEY_SECRET] }, async (request) => {
  const auth = verifiedUser(request);
  const { orderId, paymentId, signature } = (request.data ?? {}) as Record<string, unknown>;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string") throw new HttpsError("invalid-argument", "Missing payment details.");
  const record = await paymentRef(auth.uid, orderId).get();
  if (!record.exists) throw new HttpsError("not-found", "We couldn't find this order.");

  if (FAKE()) {
    if (signature !== FAKE_SIGNATURE) throw new HttpsError("permission-denied", "This payment couldn't be verified.");
    await completePayment(auth.uid, orderId, { id: paymentId, amount: record.get("amount"), method: "test" }, "app");
  } else {
    const expected = createHmac("sha256", RAZORPAY_KEY_SECRET.value()).update(`${orderId}|${paymentId}`).digest("hex");
    if (!sameSignature(expected, signature)) throw new HttpsError("permission-denied", "This payment couldn't be verified.");
    let payment = await razorpay<{ id: string; order_id: string; amount: number; status: string; method?: string }>(`/payments/${encodeURIComponent(paymentId)}`);
    if (payment.order_id !== orderId) throw new HttpsError("permission-denied", "This payment belongs to a different order.");
    if (payment.status === "authorized") {
      payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, { method: "POST", body: { amount: payment.amount, currency: "INR" } });
    }
    if (payment.status !== "captured") throw new HttpsError("failed-precondition", "The payment hasn't completed yet. If money was taken, Pro will start within a few minutes.");
    await completePayment(auth.uid, orderId, payment, "app");
  }
  const user = await db().doc(`users/${auth.uid}`).get();
  return { ok: true, planUntil: (user.get("planUntil") as Timestamp | undefined)?.toMillis() ?? null };
});

/** Step 4: Razorpay's server-to-server notice (set up in Razorpay → Webhooks, events payment.captured). */
export const razorpayWebhook = onRequest({ secrets: [RAZORPAY_WEBHOOK_SECRET, RAZORPAY_KEY_SECRET] }, async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("POST only");
    return;
  }
  const signature = String(req.get("x-razorpay-signature") ?? "");
  const expected = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET.value()).update(req.rawBody).digest("hex");
  if (!sameSignature(expected, signature)) {
    logger.warn("Webhook with a bad signature");
    res.status(400).send("bad signature");
    return;
  }
  const event = req.body as { event?: string; payload?: { payment?: { entity?: { id: string; order_id: string; amount: number; status: string; method?: string; notes?: { uid?: string } } } } };
  const payment = event.payload?.payment?.entity;
  if (event.event === "payment.captured" && payment?.order_id && payment.notes?.uid) {
    try {
      await completePayment(payment.notes.uid, payment.order_id, payment, "webhook");
    } catch (e) {
      // A refused payment (unknown order, wrong amount) is logged; Razorpay shouldn't keep retrying it
      logger.error("Webhook payment not applied", { orderId: payment.order_id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  res.status(200).send("ok");
});

/** Admin view: one person's payments, newest first. */
export async function paymentsOf(uid: string) {
  const snap = await db().collection(`users/${uid}/payments`).where("status", "==", "paid").get();
  return snap.docs
    .map((d) => ({
      orderId: d.id,
      amount: Number(d.get("amount")) || 0,
      method: (d.get("method") as string | null) ?? null,
      paidAt: (d.get("paidAt") as Timestamp | undefined)?.toMillis() ?? null,
      periodEnd: (d.get("periodEnd") as Timestamp | null | undefined)?.toMillis() ?? null,
    }))
    .sort((a, b) => (b.paidAt ?? 0) - (a.paidAt ?? 0));
}
