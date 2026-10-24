# Operations: setup and day-to-day

Project `vaultdoc-ai` (number `641269358237`), region `asia-south2` (Delhi).
Run the `gcloud` commands in **Google Cloud Shell** (console.cloud.google.com → `>_`), the `npx firebase` ones on your computer in the repo folder.

## One-time setup

### 1. Email for share invites (Resend)
1. Create a free account at resend.com → **API Keys** → create a key.
2. Store it as a secret (it's typed into the prompt, never saved in the repo):
   ```bash
   npx firebase functions:secrets:set RESEND_API_KEY --project vaultdoc-ai
   ```
3. Until your domain is verified in Resend, its test sender can only email **your own Resend account address**. After buying the domain: Resend → Domains → add it, paste the DNS records, then set `MAIL_FROM="VaultDocAI <share@yourdomain>"` in `functions/.env.vaultdoc-ai`.

### 2. Let functions create download links for shared files
Shared files download straight from Cloud Storage through 10-minute signed links. The functions' service account needs permission to sign them:
```bash
gcloud services enable iamcredentials.googleapis.com --project=vaultdoc-ai
gcloud iam service-accounts add-iam-policy-binding 641269358237-compute@developer.gserviceaccount.com \
  --member=serviceAccount:641269358237-compute@developer.gserviceaccount.com \
  --role=roles/iam.serviceAccountTokenCreator --project=vaultdoc-ai
```
Folder ZIPs are built in the recipient's browser, so the bucket's CORS list must include every website address (already has `http://localhost:3000`; add the live domain at go-live).

### 3. Admin panel
1. Put your Google account email in `functions/.env.vaultdoc-ai` → `OWNER_EMAIL=you@gmail.com`, then deploy functions.
2. Create the admin site once: `npx firebase hosting:sites:create vaultdoc-admin --project vaultdoc-ai`
3. Deploy it: `npx firebase deploy --only hosting:vaultdoc-admin --project vaultdoc-ai` → https://vaultdoc-admin.web.app
4. Open it, **Continue with Google**, click **Become Owner** (works once, only for `OWNER_EMAIL`).
5. Add teammates on the **Team** page (they must have logged in to VaultDoc with Google once).

### 4. Daily database backups (kept 7 days)
```bash
gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=7d --project=vaultdoc-ai
```
Check Cloud Storage keeps deleted files for 7 days (default for new buckets):
```bash
gcloud storage buckets describe gs://vaultdoc-ai.firebasestorage.app --format="value(soft_delete_policy)"
```

### 5. Email alerts
```bash
# Where alerts go (confirm the email Google sends you)
gcloud beta monitoring channels create --display-name="VaultDoc alerts" --type=email \
  --channel-labels=email_address=YOUR_EMAIL --project=vaultdoc-ai
CHANNEL=$(gcloud beta monitoring channels list --project=vaultdoc-ai --filter='displayName="VaultDoc alerts"' --format='value(name)')

# Policies from this repo (upload ops/alerts/*.json to Cloud Shell first, or clone the repo there)
gcloud alpha monitoring policies create --policy-from-file=ops/alerts/functions-errors.json --notification-channels=$CHANNEL --project=vaultdoc-ai
gcloud alpha monitoring policies create --policy-from-file=ops/alerts/converter-slow.json --notification-channels=$CHANNEL --project=vaultdoc-ai
```
Also: **Error Reporting** (console → Error Reporting) → **Configure notifications** → on, so new website or function errors email you. And keep the **billing budget alert** from before.

After go-live, add an uptime check for the website: Monitoring → Uptime checks → Create → URL of the site, every 5 min, alert to "VaultDoc alerts".

## Day to day
- **Admin → Overview**: sign-ups, active users, storage, shares, conversions (numbers refresh hourly; **Refresh** recalculates now).
- **Admin → System**: live checks of database, storage, logins, converter and email, plus links to Error Reporting, logs, alerts, Cloud Run and billing.
- Website crashes are reported automatically (`reportClientError` → Error Reporting, service "website").

## Launch day
1. **Let search engines list the site.** In `firebase.json`, under the `vaultdoc-ai` hosting site, delete the
   header `X-Robots-Tag: noindex, nofollow`, then `firebase deploy --only hosting:vaultdoc-ai`.
   `robots.txt` (apps/web/app/robots.ts) already keeps My Space, Vault, Account, login pages and shared links out.
2. **Google Search Console:** add the *Domain* property `vaultdocai.com` (verify with the TXT record it gives you,
   added at GoDaddy → DNS), then submit `https://vaultdocai.com/sitemap.xml`.
3. **Payments:** after Razorpay KYC is approved, switch to live keys (see "Razorpay" below).

## App Check (blocks bots from the backend)
The website sends App Check tokens (reCAPTCHA Enterprise, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` in
`apps/web/.env.local`; see `apps/web/lib/appCheck.ts`). Rollout:
1. **Watch** (now): Firebase console → App Check → APIs. Cloud Firestore, Cloud Storage and Cloud Functions show
   verified vs unverified requests. Nothing is blocked.
2. **Enforce** once nearly all requests are verified (a few days of normal use): in the same page, *Enforce* for
   Firestore and Storage; for functions, add `enforceAppCheck: true` to the callables and deploy.
   Old app versions without App Check stop working, so wait until the PWA/site has updated for everyone.
3. Local testing against the real project: open the site on localhost, copy the *debug token* printed in the
   browser console, and add it in App Check → Apps → ⋮ → Manage debug tokens. The emulators don't use App Check.

## Razorpay
- Keys: `RAZORPAY_KEY_ID` in `functions/.env.vaultdoc-ai` (public), secrets `RAZORPAY_KEY_SECRET` and
  `RAZORPAY_WEBHOOK_SECRET` (`firebase functions:secrets:set …`). Test keys start `rzp_test_`, live `rzp_live_`.
- Webhook: `https://asia-south2-vaultdoc-ai.cloudfunctions.net/razorpayWebhook`, event `payment.captured`, same
  secret as `RAZORPAY_WEBHOOK_SECRET`. Create it separately in Live mode.
- Going live: generate live keys → set the secret → change `RAZORPAY_KEY_ID` → create the live webhook →
  `firebase deploy --only functions:createProOrder,functions:verifyProPayment,functions:razorpayWebhook`.
