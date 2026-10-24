// Checks the AI features end to end on the emulators: daily limits, the cap for everyone,
// cost tracking per user and in total, the admin AI page and its permissions.
//   npm run emulators          (in one terminal; uses AI_FAKE=true, so no AI calls and no cost)
//   npm run emulators:seed     (once, for the admin Owner account)
//   npm run test:ai
// It uses its own two accounts (aitest1/aitest2@example.com) and puts the AI limits back as they were.
import { addFile, call, deleteDoc, getDoc, istDay, requireEmulators, setFields, sleep, user, where } from "./lib.mjs";

await requireEmulators();
let passed = 0;
let failed = 0;
const check = (ok, what) => {
  ok ? passed++ : failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
};
const day = istDay();
const month = day.slice(0, 7);
const questionsToday = async () => {
  const d = (await getDoc(`statsDaily/${day}`)) ?? {};
  return (d.aiQuestions ?? 0) + (d.aiAnalyses ?? 0);
};

const owner = await user("asha@example.com");
if ((await call("adminApi", { action: "whoami" }, owner)).role !== "owner") {
  console.error("asha@example.com isn't the admin Owner yet. Run:  npm run emulators:seed");
  process.exit(1);
}
const a = await user("aitest1@example.com");
const b = await user("aitest2@example.com");
const outsider = await user("aitest3@example.com"); // no admin role

// Fresh start for the test accounts: one PDF each, AI on, no usage or custom limit
for (const u of [a, b]) {
  if (u.created) await addFile(u, "aidoc", "test-agreement.pdf", Buffer.from("%PDF-1.4 test"));
  await setFields(`users/${u.uid}`, { aiEnabled: true, aiDailyLimit: undefined, aiQuestionsTotal: undefined, aiCostMicroUsdTotal: undefined });
  for (const c of ["aiUsage", "aiMonthly"]) for (const d of await where(c, "uid", u.uid)) await deleteDoc(`${c}/${d.id}`);
}
await sleep(1500); // new uploads become "ready"

const limitsBefore = (await getDoc("config/limits")) ?? {};
try {
  await setFields("config/limits", { aiDailyQuestions: 10, aiGlobalDailyQuestions: undefined });

  // ---- Cost tracking ----
  const first = await call("aiAsk", { itemId: "aidoc", question: "What is this?" }, a);
  if (!first.text?.startsWith("(Test mode)")) {
    console.error("The emulators aren't in AI test mode (AI_FAKE=true in functions/.env.demo-vaultdoc). Stopping so no real AI calls are made.");
    process.exit(1);
  }
  const dayBefore = (await getDoc(`statsDaily/${day}`))?.aiCostMicroUsd ?? 0;
  for (let i = 0; i < 2; i++) await call("aiAsk", { itemId: "aidoc", question: `Question ${i}` }, a);
  await call("aiAnalyze", { itemId: "aidoc" }, a);
  check(!!(await call("aiAsk", { itemId: "aidoc", question: "Hello" }, b)).text, "a second person gets an answer");

  const today = await getDoc(`aiUsage/${a.uid}_${day}`);
  const each = today.costMicroUsd / 4; // test mode records the same tokens for every answer
  check(today.count === 4 && each > 0 && Number.isInteger(each), `today: 4 questions, cost ${today.costMicroUsd} micro-USD`);
  const monthly = await getDoc(`aiMonthly/${a.uid}_${month}`);
  check(monthly.questions === 4 && monthly.costMicroUsd === today.costMicroUsd, "this month's record matches today");
  const totals = await getDoc(`users/${a.uid}`);
  check(totals.aiQuestionsTotal === 4 && totals.aiCostMicroUsdTotal === today.costMicroUsd, "lifetime totals on the user");
  const dayAfter = (await getDoc(`statsDaily/${day}`)).aiCostMicroUsd;
  check(dayAfter - dayBefore === 4 * each, "daily total grows by the cost of each answer");

  // ---- Admin views ----
  const overview = await call("adminApi", { action: "aiOverview" }, owner);
  check(!overview.error, `Owner opens the AI page ${overview.msg ?? ""}`);
  const rowA = overview.topUsers?.find((r) => r.email === a.email);
  const rowB = overview.topUsers?.find((r) => r.email === b.email);
  check(rowA?.questions === 4 && rowA.costMicroUsd === today.costMicroUsd && rowB?.questions === 1, "both people listed with the right numbers");
  const costs = overview.topUsers?.map((r) => r.costMicroUsd) ?? [];
  check(costs.every((c, i) => i === 0 || costs[i - 1] >= c), "top users sorted by cost");
  check(overview.limits?.defaultDaily === 10 && overview.limits.globalDaily === null, "limits read back: 10 per person, no cap");
  const detail = await call("adminApi", { action: "getUser", uid: a.uid }, owner);
  check(detail.aiUsage?.today.costMicroUsd === today.costMicroUsd && detail.aiUsage.total.questions === 4 && detail.aiUsedToday === 4, "user panel shows their AI cost");

  // ---- Who may change limits ----
  check(!!(await call("adminApi", { action: "aiOverview" }, outsider)).error, "a non-admin can't open the AI page");
  check(!!(await call("adminApi", { action: "setAiLimits", reason: "test", defaultDaily: 5, globalDaily: null }, outsider)).error, "a non-admin can't change limits");
  check(!!(await call("adminApi", { action: "setAiLimits", defaultDaily: 5, globalDaily: null }, owner)).error, "a reason is required");
  check(!!(await call("adminApi", { action: "setAiLimits", reason: "test", defaultDaily: 900, globalDaily: null }, owner)).error, "out-of-range limits are refused");

  // ---- Per-person limit ----
  check(!(await call("adminApi", { action: "setAiLimits", reason: "automated test", defaultDaily: 5, globalDaily: null }, owner)).error, "Owner sets 5 questions per person");
  check(!(await call("aiAsk", { itemId: "aidoc", question: "Fifth" }, a)).error, "5th question allowed");
  const sixth = await call("aiAsk", { itemId: "aidoc", question: "Sixth" }, a);
  check(sixth.reason === "quota", `6th question refused: ${sixth.msg}`);
  const info = await call("aiInfo", { itemId: "aidoc" }, a);
  check(info.quota?.limit === 5 && info.quota.used === 5, "the panel shows 5 of 5");
  check(!(await call("adminApi", { action: "userAction", op: "setAiLimit", uid: a.uid, aiDailyLimit: 20, reason: "automated test" }, owner)).error, "Owner gives one person a custom limit of 20");
  check(!(await call("aiAsk", { itemId: "aidoc", question: "With custom limit" }, a)).error, "their custom limit beats the default");

  // ---- Cap for everyone ----
  await call("adminApi", { action: "setAiLimits", reason: "automated test", defaultDaily: 10, globalDaily: await questionsToday() }, owner);
  const capped = await call("aiAsk", { itemId: "aidoc", question: "Over the cap?" }, b);
  check(capped.reason === "globalQuota", `cap for everyone refuses the next question: ${capped.msg}`);
  check((await getDoc(`aiUsage/${b.uid}_${day}`)).count === 1, "a refused question isn't counted");
  await call("adminApi", { action: "setAiLimits", reason: "automated test", defaultDaily: 10, globalDaily: 0 }, owner);
  check((await call("aiAsk", { itemId: "aidoc", question: "Paused?" }, b)).reason === "globalQuota", "cap 0 pauses AI");
  await call("adminApi", { action: "setAiLimits", reason: "automated test", defaultDaily: 10, globalDaily: null }, owner);
  check(!(await call("aiAsk", { itemId: "aidoc", question: "Back?" }, b)).error, "no cap: AI works again");

  // ---- Audit log ----
  const audits = await where("adminAudit", "action", "ai.setLimits");
  check(audits.some((x) => x.data.reason === "automated test"), "limit changes are in the audit log");
} finally {
  // Put the limits back exactly as they were
  await setFields("config/limits", { aiDailyQuestions: limitsBefore.aiDailyQuestions, aiGlobalDailyQuestions: limitsBefore.aiGlobalDailyQuestions });
  await setFields(`users/${a.uid}`, { aiDailyLimit: undefined });
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
