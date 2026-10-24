// Checks buying Pro on the emulators (PAYMENTS_FAKE=true: no Razorpay, no money): orders, verification,
// the webhook, counting each payment once, extending Pro, and the admin view.
//   npm run emulators   ·   npm run emulators:seed (once)   ·   npm run test:payments
// Uses its own accounts (paytest1/2/3@example.com).
import { createHmac } from "node:crypto";
import { call, claimsOf, deleteDoc, getDoc, istDay, listDocs, requireEmulators, user, waitFor } from "./lib.mjs";

await requireEmulators();
let passed = 0;
let failed = 0;
const check = (ok, what) => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
};
const DAY = 86_400_000;
const FAKE_SIGNATURE = "fake-signature-emulator";
// The emulator's placeholder webhook secret (functions/.secret.local)
const WEBHOOK_SECRET = "emulator-not-used";
const WEBHOOK = "http://127.0.0.1:5001/demo-vaultdoc/asia-south2/razorpayWebhook";

const owner = await user("asha@example.com");
if ((await call("adminApi", { action: "whoami" }, owner)).role !== "owner") {
  console.error("asha@example.com isn't the admin Owner yet. Run:  npm run emulators:seed");
  process.exit(1);
}
let buyer = await user("paytest1@example.com");
const other = await user("paytest2@example.com");
const unverified = await user("paytest3@example.com", { verified: false });

// Fresh start: Free, no payments
for (const u of [buyer, other]) {
  await call("adminApi", { action: "userAction", op: "setPlan", uid: u.uid, plan: "free", reason: "automated test" }, owner);
  for (const p of await listDocs(`users/${u.uid}/payments`)) await deleteDoc(`users/${u.uid}/payments/${p.id}`);
}
buyer = await user(buyer.email);
const revenue = async () => (await getDoc(`statsDaily/${istDay()}`))?.revenuePaise ?? 0;
const revenueBefore = await revenue();

// ---- Ordering ----
check(!!(await call("createProOrder", {}, unverified)).error, "an unverified email can't buy");
const order = await call("createProOrder", {}, buyer);
check(order.orderId?.startsWith("order_") && order.amount === 39900 && order.currency === "INR", `order for ₹399: ${order.orderId}`);
check((await getDoc(`users/${buyer.uid}/payments/${order.orderId}`))?.status === "created", "order recorded as created");

// ---- Verification ----
check(!!(await call("verifyProPayment", { orderId: order.orderId, paymentId: "pay_x", signature: "forged" }, buyer)).error, "a forged signature is refused");
check(!!(await call("verifyProPayment", { orderId: order.orderId, paymentId: "pay_x", signature: FAKE_SIGNATURE }, other)).error, "someone else can't use your order");
const paid = await call("verifyProPayment", { orderId: order.orderId, paymentId: "pay_test1", signature: FAKE_SIGNATURE }, buyer);
const end1 = paid.planUntil;
check(paid.ok && Math.abs(end1 - (Date.now() + 30 * DAY)) < 60_000, "paid: Pro for 30 days from now");
check((await getDoc(`users/${buyer.uid}`)).plan === "pro" && (await claimsOf(buyer.uid)).plan === "pro", "users record and login claim say Pro");
const rec = await getDoc(`users/${buyer.uid}/payments/${order.orderId}`);
check(rec.status === "paid" && rec.planApplied === true && rec.paymentId === "pay_test1", "payment recorded as paid");

const again = await call("verifyProPayment", { orderId: order.orderId, paymentId: "pay_test1", signature: FAKE_SIGNATURE }, buyer);
check(again.planUntil === end1, "verifying the same payment again changes nothing");
check((await revenue()) - revenueBefore === 39900, "revenue counted once (₹399)");

// ---- Paying again extends ----
const order2 = await call("createProOrder", {}, buyer);
const paid2 = await call("verifyProPayment", { orderId: order2.orderId, paymentId: "pay_test2", signature: FAKE_SIGNATURE }, buyer);
check(Math.abs(paid2.planUntil - (end1 + 30 * DAY)) < 5_000, "paying again adds 30 days to the end of current Pro");

// ---- Webhook ----
const order3 = await call("createProOrder", {}, other);
const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_hook1", order_id: order3.orderId, amount: 39900, status: "captured", method: "upi", notes: { uid: other.uid } } } } });
const sign = (b) => createHmac("sha256", WEBHOOK_SECRET).update(b).digest("hex");
const bad = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": "nope" }, body });
check(bad.status === 400, "webhook with a bad signature is refused");
const good = await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": sign(body) }, body });
check(good.status === 200, "webhook with Razorpay's signature is accepted");
check(await waitFor(async () => (await getDoc(`users/${other.uid}`))?.plan === "pro"), "webhook alone starts Pro (browser closed mid-way)");
const until3 = (await call("adminApi", { action: "getUser", uid: other.uid }, owner)).user.planUntil;
await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": sign(body) }, body });
const app3 = await call("verifyProPayment", { orderId: order3.orderId, paymentId: "pay_hook1", signature: FAKE_SIGNATURE }, other);
check(app3.planUntil === until3, "webhook repeated + the app reporting the same payment: counted once");
const wrong = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_hook2", order_id: (await call("createProOrder", {}, other)).orderId, amount: 100, status: "captured", notes: { uid: other.uid } } } } });
await fetch(WEBHOOK, { method: "POST", headers: { "Content-Type": "application/json", "x-razorpay-signature": sign(wrong) }, body: wrong });
check((await getDoc(`users/${other.uid}`)).planUntil !== undefined && (await call("adminApi", { action: "getUser", uid: other.uid }, owner)).user.planUntil === until3, "a payment with the wrong amount is ignored");

// ---- Admin view ----
const detail = await call("adminApi", { action: "getUser", uid: buyer.uid }, owner);
check(detail.payments?.length === 2 && detail.payments.every((p) => p.amount === 39900), "admin sees 2 payments of ₹399");
check((await revenue()) - revenueBefore === 3 * 39900, "today's revenue: 3 payments");

// ---- Pro with no end date stays unlimited ----
await call("adminApi", { action: "userAction", op: "setPlan", uid: buyer.uid, plan: "pro", until: null, reason: "automated test" }, owner);
const order4 = await call("createProOrder", {}, buyer);
const paid4 = await call("verifyProPayment", { orderId: order4.orderId, paymentId: "pay_test4", signature: FAKE_SIGNATURE }, buyer);
check(paid4.planUntil === null, "Pro with no end date stays unlimited after paying");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
