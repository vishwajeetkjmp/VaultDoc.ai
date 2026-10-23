# Trying VaultDoc locally (test mode)

Everything here runs on the Firebase emulators: fake accounts and files on your Mac, wiped when the emulators stop. Your real project is never touched.

## Start
```bash
npm run emulators            # Firebase emulators (dashboard: http://127.0.0.1:4000)
npm run dev:emulators        # website  → http://localhost:3000
npm run dev:admin:emulators  # admin    → http://localhost:3100
```

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
