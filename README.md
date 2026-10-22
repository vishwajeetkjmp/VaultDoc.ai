# VaultDocAI

> Understand every document in seconds.

AI document intelligence platform. Upload contracts, reports, invoices, and scanned
pages. Ask questions in plain language and get answers grounded in your own files —
kept private to your account.

## Monorepo structure

```
apps/web        # Next.js landing page (Phase 1)
packages/core   # Shared tool framework (ITool, ToolRegistry, ToolFactory)
```

## Getting started

```bash
# install dependencies (from repo root)
npm install

# run the web app
npm run dev
```

Then open http://localhost:3000

## Features (Phase 1)

- Professional, responsive landing page
- 3 theme toggle: Dark Blue (default) → Grey → Off-White/Yellow (persisted)
- "Free Tool" dropdown rendered from an extensible tool registry (SOLID)
- Sign In / Sign Up placeholder routes

## Roadmap

- **Phase 1** — Landing page + monorepo foundation ✅
- **Phase 2** — Authentication (Firebase)
- **Phase 3** — Document upload & storage
- **Phase 4** — AI Q&A (RAG) + cloud deploy
- **Phase 5** — Tool implementations (PDF convert, image resize/crop)
- **Phase 6** — Mobile app