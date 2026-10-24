# Trying VaultDoc locally (test mode)

Everything here runs on the Firebase emulators: fake accounts and files on your Mac, wiped when the emulators stop. Your real project is never touched.

## Start
```bash
npm run emulators            # Firebase emulators (dashboard: http://127.0.0.1:4000)
npm run dev:emulators        # website  → http://localhost:3000
npm run dev:admin:emulators  # admin    → http://localhost:3100
npm run emulators:seed       # once per emulator start: creates the test accounts below
```
The emulators start empty each time, so run `npm run emulators:seed` after starting them. It's safe to run again.

## Test accounts (emulators only)
All use the password **`pass-1234`**.

| Email | What it is |
|---|---|
| `asha@example.com` | Admin **Owner** (use the "Test login" box on the admin page) |
| `priya@example.com`, `rahul@example.com`, `arjun@example.com`, `kavya@example.com`, `rohan@example.com` | Normal users with sample PDFs; `kavya` invited `priya` to a file |
| `meera@example.com` | Email not verified yet |

You can also make a new account on the website with **Login → Continue with Google → Add new account** (a pretend Google popup).

## Things to try
**Sharing (website)**
1. Log in as `rohan` → right-click a PDF → **Share** → add `priya@example.com`, choose **Only people you invite**, set an expiry → **Send**. (Emails aren't sent in test mode; they're printed in the emulator log as `[dev mail]`.)
2. **Shared by me** shows the link with views/downloads. **Copy link** from the ⋯ menu.
3. Open the link in a private window: it asks you to log in. Log in as `priya` → the file opens with Preview/Download. Log in as someone else → "Shared with a different email".
4. Make a folder with a subfolder, upload a few files, share it as **Anyone with the link**, open the link → browse subfolders → **Download all** (ZIP).
5. **Stop sharing** → the link shows "This link isn't active".

**Admin (http://localhost:3100)**
1. Log in with the Test login box as `asha`.
2. **Overview** → **Refresh**; **Users** → click a user → try **Change storage quota** or **Disable** (a reason is required).
3. **Audit log** shows every change; **Team** → add `rahul@example.com` as Support, then log in as `rahul` in a private window to see the Support view.
4. **System** shows live checks (the Word converter shows a problem unless Docker's converter is running; email shows "no key" in test mode).
5. **AI** shows questions and cost today and this month, and the top AI users. As `asha`, **Change** sets the questions per person per day and an optional cap for everyone together (0 pauses AI).

**AI (website)**
AI runs in test mode on the emulators (`AI_FAKE=true` in `functions/.env.demo-vaultdoc`): answers are canned, nothing is sent to Google, nothing costs money. Costs still add up (as if each answer were a 2-page PDF) so the admin AI page has numbers.
1. Log in as `rohan` → **✨ Ask AI** in the toolbar → pick a PDF (or select a file first, then click Ask AI). Turn AI on when asked.
2. **Summarise this file** → a test summary with a date → **🔔 Remind me** → it appears under **Reminders** in the sidebar.
3. **Ask** tab → type a question → a streamed test answer; the counter shows "N of 10 left today".
4. In the admin panel, **AI** now lists `rohan` with his cost; **Users → rohan** shows today / this month / total.

**Pro plan (website + admin)**
1. Admin → **Users** → `rohan` → **Change plan** → Pro (optional end date) → a reason → Save. The list shows a Pro badge.
2. Website as `rohan`: storage shows 10 GB and 50 MB per file; **Account → Plan** says Pro.
3. In My Space, select several files: ⌘/Ctrl-click or Shift-click (on a phone, long-press a file, then tap others). The bar at the bottom shows **N selected · ✨ Ask AI · Clear**.
4. **Ask AI** → the panel lists the files → **Summarise these files** gives an overview and a card per file; **Remind me** on any date sets a reminder for that file. The **Ask** tab answers across all of them.
5. As a Free user (e.g. `arjun`), selecting two files and clicking **Ask AI · Pro** explains Pro instead.

## Automated checks
```bash
npm run test:ai   # AI limits, cap for everyone, cost tracking, admin AI page and permissions
npm run test:pro  # Pro: granting it, AI across several files, combined summary, limits, expiry, 50 MB uploads
```
Needs the emulators running and seeded. It uses its own accounts (`aitest1/2/3@example.com`), refuses to run unless AI test mode is on, and puts the AI limits back as they were.

## Real AI answers
The emulators always use test mode: they run as the pretend project `demo-vaultdoc`, which has no Google AI access. Check real answers on the live site with your own account (each question costs well under ₹1, and failed answers aren't counted).
