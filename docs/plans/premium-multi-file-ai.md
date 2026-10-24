# Plan: Premium — AI across several files (v2)

Status: **draft for review**. Nothing here is built yet. Today every user asks AI about one file at a time
(10 questions a day), and the toolbar's **Ask AI** menu already shows "Several files together · Premium" as a
"coming soon" entry.

## What Premium users get
- **Select several files** (or a whole folder) and ask one question across all of them:
  "Which of my insurance policies expire this year?", "Compare the rent in these two agreements",
  "Total of all invoices from Acme".
- **Answers say where each fact came from**: file name and page, e.g. "(Rent-2025.pdf, p. 2)".
- **A combined summary** of the selection: one card listing every document, its type, key amounts and dates,
  with **Remind me** on each date (reuses today's reminders).
- **Higher daily limits** (suggested below) and longer documents.

## How it works (recommended approach)
**Phase A (v2): send the selected files together.**
Gemini 3.1 Flash-Lite reads PDFs, photos and Word files (after conversion) and accepts very long inputs, so the
simplest reliable way is to send all selected files in one request, each with its name, like today's single
file. Follow-up questions about the same selection are cheaper because Google reuses (caches) the documents
automatically.
- Limits per question: up to **20 files** and about **300 pages** in total (keeps cost and wait time predictable).
- Same safety rules as today: My Space only (never the Secure Vault), consent required, documents treated as
  data, not instructions.

**Phase B (later, v3): "Ask my whole space".**
For questions across hundreds of files, sending everything isn't practical. Instead each file gets a small
searchable index when uploaded (text pieces plus "embeddings"), and a question first finds the most relevant
pieces, then only those go to the AI. More work (indexing, storage, re-indexing on change), so only worth it
once Phase A is used.

## Cost estimate (Gemini 3.1 Flash-Lite list price, ₹84 per US$)
A PDF page is roughly 500 input tokens.

| Selection | Input tokens | Cost per question |
|---|---|---|
| 5 files × 4 pages | ~10,000 | ≈ ₹0.3 |
| 10 files × 5 pages | ~25,000 | ≈ ₹0.6 |
| 300 pages (the cap) | ~150,000 | ≈ ₹3.3 |

Follow-up questions on the same selection cost much less (cached input is a tenth of the price). The admin AI
page already tracks each person's cost, so Premium usage shows up there without extra work.

## Suggested limits
| | Free | Premium |
|---|---|---|
| Questions per day | 10 | 50 |
| Files per question | 1 | 20 |
| Pages per question | ~60 | ~300 |

A multi-file question counts as **1 question** for simplicity (cost is still tracked exactly). The admin
**cap for everyone** keeps protecting the total bill.

## What gets built
1. **Who is Premium**: `users/{uid}.plan = "premium"` (with an end date), set only by the server after a
   payment, never by the browser. The functions read it to pick the limits above. Admin panel: show the plan
   and allow granting Premium by hand (for testers), with a reason in the audit log.
2. **Payments** (separate piece, needed before charging): an Indian payment provider that supports UPI and
   subscriptions (e.g. Razorpay or Cashfree). A webhook function marks the user Premium and records the payment.
3. **Selecting several files**: checkboxes in the file list (and Shift/Ctrl-click), a bar showing
   "3 selected · ✨ Ask AI · Clear". Free users who select several see a short Premium explanation instead.
4. **Server**: `aiAsk`/`aiAnalyze` accept `itemIds` (1 for free, up to 20 for Premium), load and convert each
   file (in parallel), check the page cap, then send them together with file names. Answers mention
   "(file, p. N)". Saved combined summaries live under `users/{uid}/aiInsights` keyed by the selection.
5. **AI panel**: file chips at the top for the selection; the rest of the panel (Summary / Ask / reminders,
   streaming, limits) stays as it is.
6. **Tests**: extend `npm run test:ai` (Premium limits, file cap, page cap, a free user refused with several files).

Rough effort: items 1, 3–6 about 2–3 days; payments (item 2) about 2 days plus the provider's account approval.

## Decisions needed from you
- **Price** of Premium (monthly / yearly) and whether there's a free trial.
- **Payment provider** (needs a business or individual account with KYC).
- The **limits** in the table above.
- Whether Premium should also raise **storage** (today 1 GB) — the Pricing page plans can be updated together.
