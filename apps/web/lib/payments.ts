"use client";

import { call } from "./callable";

/**
 * Buying Pro (see functions/src/payments.ts): our server creates the order, Razorpay Checkout takes the
 * payment, our server checks it with Razorpay and adds 30 days of Pro. Razorpay's script loads only here.
 */
type Order = { orderId: string; keyId: string; amount: number; currency: string; email: string; name: string };
type RazorpayResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
type RazorpayCheckout = { open: () => void; on: (event: string, fn: (r: { error?: { description?: string } }) => void) => void };
declare global {
  interface Window {
    Razorpay?: new (options: object) => RazorpayCheckout;
  }
}

/** Emulators: no Razorpay; the server accepts this in place of a real signature */
const FAKE_KEY = "rzp_test_fake";
const FAKE_SIGNATURE = "fake-signature-emulator";

let script: Promise<void> | null = null;
function loadCheckout(): Promise<void> {
  script ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve();
    s.onerror = () => {
      script = null;
      reject(new Error("The payment window couldn't load. Check your connection and try again."));
    };
    document.head.appendChild(s);
  });
  return script;
}

export type CheckoutResult = { status: "paid"; planUntil: number | null } | { status: "closed" };

/** Opens checkout for 30 days of Pro. Resolves when paid (and Pro is on) or when the window is closed. */
export async function buyPro(): Promise<CheckoutResult> {
  const order = await call<object, Order>("createProOrder", {});
  const verify = (r: RazorpayResponse) =>
    call<object, { ok: boolean; planUntil: number | null }>("verifyProPayment", {
      orderId: r.razorpay_order_id,
      paymentId: r.razorpay_payment_id,
      signature: r.razorpay_signature,
    });

  if (order.keyId === FAKE_KEY) {
    // Local testing: pretend the payment went through
    if (!window.confirm(`Test mode: pretend to pay ₹${order.amount / 100} for Pro?`)) return { status: "closed" };
    const r = await verify({ razorpay_order_id: order.orderId, razorpay_payment_id: `pay_fake_${Date.now()}`, razorpay_signature: FAKE_SIGNATURE });
    return { status: "paid", planUntil: r.planUntil };
  }

  await loadCheckout();
  return new Promise<CheckoutResult>((resolve, reject) => {
    const checkout = new window.Razorpay!({
      key: order.keyId,
      order_id: order.orderId,
      amount: order.amount,
      currency: order.currency,
      name: "VaultDocAI",
      description: "Pro · 30 days",
      prefill: { email: order.email, name: order.name },
      theme: { color: "#3b82f6" },
      handler: (r: RazorpayResponse) => verify(r).then((v) => resolve({ status: "paid", planUntil: v.planUntil }), reject),
      modal: { ondismiss: () => resolve({ status: "closed" }) },
    });
    checkout.on("payment.failed", (r) => reject(new Error(r.error?.description || "The payment didn't go through. No money was taken.")));
    checkout.open();
  });
}
