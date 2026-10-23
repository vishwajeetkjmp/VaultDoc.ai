# VaultDocAI

> Understand every document in seconds.

AI document intelligence platform. Upload contracts, reports, invoices, and scanned
pages. Ask questions in plain language and get answers grounded in your own files —
kept private to your account.

## Monorepo structure

```
apps/web        # Next.js app: landing page, sign-in, My Files
packages/core   # Shared tool framework (ITool, ToolRegistry, ToolFactory)
functions       # Cloud Functions (keep each user's storage total)
firebase        # Firestore + Storage security rules
```

## Getting started

```bash
# install dependencies (from repo root)
npm install

# run the web app
npm run dev
```

Then open http://localhost:3000

### Local development with the Firebase emulators

Runs Auth, Firestore, Storage and Functions on your machine (needs Java), using a
`demo-` project so nothing touches the real one:

```bash
npm run emulators       # terminal 1 (UI at http://localhost:4000)
npm run dev:emulators   # terminal 2
```

## My Files: cloud storage setup (one time)

1. In the Firebase console, create **Firestore** and **Storage** in `asia-south2`
   (Delhi), in production mode. Storage needs the **Blaze** plan.
2. Deploy the security rules and functions:
   ```bash
   npx firebase login
   npm run deploy:rules
   npm run deploy:functions
   ```
3. Allow the app to download files from the bucket (edit the origins in
   `firebase/storage-cors.json` to your real domain first):
   ```bash
   gcloud storage buckets update gs://vaultdoc-ai.firebasestorage.app --cors-file=firebase/storage-cors.json
   ```

### Limits

Defaults: **20 MB per file**, **1 GB per user**, ZIPs up to 100 MB / 1,000 files
(unpacked in the browser; only their contents are stored). To change them without
a code change, create the Firestore document `config/limits` with any of:
`maxFileBytes`, `quotaBytes`, `maxZipBytes`, `maxZipEntries` (sizes in bytes).
A single user's quota can be raised with `quotaBytes` on `users/{uid}`.

## Features (Phase 1)

- Professional, responsive landing page
- 3 theme toggle: Dark Blue (default) → Grey → Off-White/Yellow (persisted)
- "Free Tool" dropdown rendered from an extensible tool registry (SOLID)
- Sign In / Sign Up placeholder routes

## Secure Vault (end-to-end encrypted)

A separate area (`/vault`) for highly sensitive documents. Files, names and types
are encrypted **in the browser** (AES-256-GCM, Web Crypto) before upload, so the
server, and anyone with Firebase console access, only ever sees ciphertext.

- **Recovery key** (shown once at setup) wraps the vault key; needed on a new device.
  If the recovery key and every set-up device are lost, the vault can't be opened by anyone.
- **6-digit PIN** unlocks the vault on a device (the vault key is stored there wrapped
  by a non-extractable device key). 5 wrong PINs → 15-minute pause; 10 → recovery key required.
- **Auto-lock** after 60 s without activity; **new PIN every 6 days** (current PIN required).
- **Forgot PIN:** an email link confirms the account and allows a new PIN on a device
  that's already set up. Enable *Email link (passwordless sign-in)* in Firebase
  Authentication for this to work.
- Server-side AI features can't read vault files, by design.

## Features (Phase 3)

- My Files: folders, upload (button or drag and drop), rename, delete, open, download
- ZIP upload, unpacked into folders in the browser
- Instant rejection of oversized or unsupported files; duplicates skipped
- Per-user storage total, shown in the sidebar and the profile card
- Security rules keep each user's files private and enforce the limits server-side

## Roadmap

- **Phase 1** — Landing page + monorepo foundation ✅
- **Phase 2** — Authentication (Firebase)
- **Phase 3** — Document upload & storage ✅
- **Phase 4** — AI Q&A (RAG) + cloud deploy
- **Phase 5** — Tool implementations (PDF convert, image resize/crop)
- **Phase 6** — Mobile app