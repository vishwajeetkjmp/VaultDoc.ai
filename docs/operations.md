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
