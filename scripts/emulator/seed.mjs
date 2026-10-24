// Creates the test accounts and sample files described in docs/local-testing.md.
// Safe to run again: accounts that already exist are left as they are.
//   npm run emulators        (in one terminal)
//   npm run emulators:seed   (in another)
import { addFile, call, requireEmulators, setFields, sleep, user } from "./lib.mjs";

await requireEmulators();

// Normal users with a few sample PDFs (sizes differ so the admin "biggest users" list has an order)
const names = ["priya", "rahul", "meera", "arjun", "kavya", "rohan"];
for (const [i, name] of names.entries()) {
  const unverified = name === "meera"; // shows the "verify your email" screen
  const u = await user(`${name}@example.com`, { verified: !unverified });
  if (!u.created) {
    console.log(`${u.email} already exists`);
    continue;
  }
  if (!unverified) {
    for (let f = 0; f < i + 1; f++) await addFile(u, `${name}f${f}`, `${name}-doc-${f}.pdf`, Buffer.alloc(40_000 * (i + 1) * (f + 1), 7));
    await sleep(1500); // let onFileUploaded mark the files ready
    if (name === "kavya") await call("saveShare", { itemId: "kavyaf0", mode: "invite", invitees: ["priya@example.com"], expiresAt: null }, u);
    else if (i % 2 === 0) await call("saveShare", { itemId: `${name}f0`, mode: "link", invitees: [], expiresAt: null }, u);
  }
  console.log(`${u.email} created`);
}

// Admin Owner: asha (OWNER_EMAIL in functions/.env.demo-vaultdoc)
const asha = await user("asha@example.com");
const claim = await call("adminApi", { action: "claimOwner" }, asha);
console.log(claim.error ? `asha@example.com: ${claim.msg}` : "asha@example.com is the admin Owner");

// 30 days of sample activity so the admin charts have something to show
for (let d = 0; d < 30; d++) {
  const day = new Date(Date.now() + 5.5 * 3_600_000 - d * 86_400_000).toISOString().slice(0, 10);
  await setFields(`statsDaily/${day}`, {
    day,
    conversions: Math.round(4 + 6 * Math.sin(d / 3) + (30 - d) / 3),
    shareOpens: Math.max(0, Math.round(2 + (30 - d) / 4 + 3 * Math.cos(d))),
    storageBytes: Math.round((30 - d) * 1.4e6 + 2e6),
  });
}
console.log(`\nDone. Every test account uses the password "pass-1234".`);
process.exit(0);
