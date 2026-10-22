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

1. In the Firebase console, create **Firestore** and **Storage** in `asia-south1`
   (Mumbai), in production mode. Storage needs the **Blaze** plan.
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