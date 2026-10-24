// Checks the Pro plan on the emulators: granting it from the admin panel, AI across several files,
// limits, the combined summary, expiry, and Pro's bigger storage.
//   npm run emulators   ·   npm run emulators:seed (once)   ·   npm run test:pro
// Uses its own accounts (protest1/2/3@example.com). AI runs in test mode, so nothing costs money.
import { createRequire } from "node:module";
import { addFile, call, claimsOf, deleteDoc, getDoc, listDocs, requireEmulators, setFields, tryUpload, user, waitFor, where } from "./lib.mjs";

await requireEmulators();
let passed = 0;
let failed = 0;
const check = (ok, what) => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
};
const MB = 1024 * 1024;

const owner = await user("asha@example.com");
if ((await call("adminApi", { action: "whoami" }, owner)).role !== "owner") {
  console.error("asha@example.com isn't the admin Owner yet. Run:  npm run emulators:seed");
  process.exit(1);
}
let pro = await user("protest1@example.com");
const free = await user("protest2@example.com");
const team = await user("protest3@example.com"); // has an admin role too: Pro must not remove it

// Fresh start: Free, AI on, three small documents each, no usage
for (const u of [pro, free]) {
  await call("adminApi", { action: "userAction", op: "setPlan", uid: u.uid, plan: "free", reason: "automated test" }, owner);
  await setFields(`users/${u.uid}`, { aiEnabled: true, aiDailyLimit: undefined });
  for (const d of await where("aiUsage", "uid", u.uid)) await deleteDoc(`aiUsage/${d.id}`);
  for (const n of [1, 2, 3]) if (!(await getDoc(`users/${u.uid}/items/doc${n}`))) await addFile(u, `doc${n}`, `contract-${n}.pdf`, Buffer.from(`%PDF-1.4 doc ${n}`));
}
// Uploads become "ready" once onFileUploaded has run
const ready = (u, id) => waitFor(async () => (await getDoc(`users/${u.uid}/items/${id}`))?.status === "ready");
for (const u of [pro, free]) for (const n of [1, 2, 3]) await ready(u, `doc${n}`);

// ---- Granting Pro ----
check(!!(await call("adminApi", { action: "userAction", op: "setPlan", uid: pro.uid, plan: "pro", reason: "test" }, free)).error, "a non-admin can't grant Pro");
check(!!(await call("adminApi", { action: "userAction", op: "setPlan", uid: pro.uid, plan: "pro", until: Date.now() - 1000, reason: "test" }, owner)).error, "an end date in the past is refused");
const grant = await call("adminApi", { action: "userAction", op: "setPlan", uid: pro.uid, plan: "pro", until: null, reason: "automated test" }, owner);
check(!grant.error, `Owner grants Pro ${grant.msg ?? ""}`);
check((await getDoc(`users/${pro.uid}`)).plan === "pro", "users record says Pro");
check((await claimsOf(pro.uid)).plan === "pro", "login claim says Pro");
await call("adminApi", { action: "setRole", email: team.email, role: "viewer", reason: "automated test" }, owner);
await call("adminApi", { action: "userAction", op: "setPlan", uid: team.uid, plan: "pro", until: null, reason: "automated test" }, owner);
const teamClaims = await claimsOf(team.uid);
check(teamClaims.plan === "pro" && teamClaims.role === "viewer", "Pro keeps an admin role claim");
await call("adminApi", { action: "userAction", op: "setPlan", uid: team.uid, plan: "free", reason: "automated test" }, owner);
const teamAfter = await claimsOf(team.uid);
check(!teamAfter.plan && teamAfter.role === "viewer", "back to Free keeps the admin role claim");
await call("adminApi", { action: "setRole", email: team.email, role: null, reason: "automated test" }, owner);
const row = (await call("adminApi", { action: "getUser", uid: pro.uid }, owner)).user;
check(row?.plan === "pro", "admin user panel shows Pro");
const audit = await where("adminAudit", "action", "user.setPlan");
check(audit.some((a) => a.data.reason === "automated test"), "plan changes are in the audit log");

pro = await user(pro.email); // fresh login token with the Pro claim

// ---- AI across several files ----
const three = ["doc1", "doc2", "doc3"];
const freeTry = await call("aiAsk", { itemIds: ["doc1", "doc2"], question: "Compare" }, free);
check(freeTry.reason === "pro", `Free user with 2 files gets the Pro message: ${freeTry.msg}`);
check(!!(await call("aiAsk", { itemIds: ["doc1"], question: "One file" }, free)).text, "Free user with 1 file (as a list) still works");
check((await getDoc(`aiUsage/${free.uid}_${new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)}`))?.count === 1, "the refused question wasn't counted");

const info = await call("aiInfo", { itemIds: three }, pro);
check(info.plan === "pro" && info.quota?.limit === 50 && info.supported, "Pro: 50 questions a day, 3 files readable");
const ask = await call("aiAsk", { itemIds: three, question: "What differs?" }, pro);
check(/3 files/.test(ask.text ?? ""), `Pro gets an answer about 3 files: ${ask.text?.slice(0, 60) ?? ask.msg}`);
const sum = await call("aiAnalyze", { itemIds: three }, pro);
const docs = sum.combined?.documents ?? [];
check(docs.length === 3 && docs.every((d, i) => d.itemId === three[i] && d.dates.length === 1), "combined summary: one entry per file, each linked to its file");
const saved = (await listDocs(`users/${pro.uid}/aiInsights`)).find((d) => d.id.startsWith("multi_") && d.data.itemIds?.join() === three.join());
check(!!saved && !!(await call("aiInfo", { itemIds: [...three].reverse() }, pro)).combined, "combined summary is saved (the same files in any order find it)");
check(!!(await call("aiInfo", { itemIds: Array.from({ length: 21 }, (_, i) => `x${i}`) }, pro)).error, "more than 20 files is refused");

// A reminder from the second file's date
const date = docs[1]?.dates[0];
// (Reminders are written by the browser under rules; here we only check the date belongs to doc2)
check(date && docs[1].itemId === "doc2", "a date in the summary points at its own file (for Remind me)");

// Deleting one of the files removes the combined summary (onItemDeleted)
await deleteDoc(`users/${pro.uid}/items/doc3`);
const gone = await waitFor(async () => !(await getDoc(`users/${pro.uid}/aiInsights/${saved?.id}`)));
check(gone, "deleting one of the files removes the combined summary");

// ---- Bigger storage ----
check(await tryUpload(pro, "big1", "big-scan.pdf", Buffer.alloc(30 * MB, 1)), "Pro can upload a 30 MB file");
check(!(await tryUpload(free, "big1", "big-scan.pdf", Buffer.alloc(30 * MB, 1))), "Free can't upload a 30 MB file (Storage rules)");
check(await ready(pro, "big1"), "the 30 MB file is accepted (Pro quota and size)");
await deleteDoc(`users/${pro.uid}/items/big1`);
await deleteDoc(`users/${free.uid}/items/big1`);

// ---- Expiry ----
await setFields(`users/${pro.uid}`, { planUntil: undefined });
await fetch(`http://127.0.0.1:8080/v1/projects/demo-vaultdoc/databases/(default)/documents/users/${pro.uid}?updateMask.fieldPaths=planUntil`, {
  method: "PATCH",
  headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
  body: JSON.stringify({ fields: { planUntil: { timestampValue: new Date(Date.now() - 60_000).toISOString() } } }),
});
check((await call("aiInfo", { itemIds: ["doc1"] }, pro)).plan === "free", "Pro past its end date counts as Free straight away");
// Run the nightly job's code against the emulators
Object.assign(process.env, { GCLOUD_PROJECT: "demo-vaultdoc", FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080", FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099" });
const plans = createRequire(import.meta.url)("../../functions/lib/plans.js");
const ended = await plans.expirePlansNow();
check(ended >= 1 && !(await claimsOf(pro.uid)).plan && !(await getDoc(`users/${pro.uid}`)).plan, `nightly job ends expired Pro (claim and record) — ${ended} ended`);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
