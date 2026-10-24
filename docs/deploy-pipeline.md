# Deploy pipeline (GitHub Actions)

```
push to main ──► CI (.github/workflows/ci.yml)          type-check, build, emulator tests
                   │ passed
                   ▼
                 Deploy (.github/workflows/deploy.yml)   waits for your Approve
                   │ approved
                   ▼
                 Firebase Hosting: vaultdocai.com + admin.vaultdocai.com
```

Functions and Firestore/Storage rules are still deployed from the Mac (`npm run deploy:functions`,
`npm run deploy:rules`).

## How GitHub gets into Google Cloud (no keys)

Workload Identity Federation: when the deploy job runs, GitHub gives it a signed token saying
"repo vishwajeetkjmp/VaultDoc.ai, environment production". Google checks GitHub's signature, and lets
that token act as the service account `github-deployer` for about an hour. Nothing secret is stored
in GitHub, and only a job in the `production` environment (which needs your approval) gets in.

`github-deployer` may only publish Hosting; it can't read the database, files or secrets.

## One-time setup

### 1. Google Cloud (Cloud Shell)

Open https://console.cloud.google.com/?project=vaultdoc-ai, click the Cloud Shell icon (top right, `>_`),
and paste the blocks one at a time.

```bash
PROJECT_ID=vaultdoc-ai
PROJECT_NUMBER=641269358237
REPO=vishwajeetkjmp/VaultDoc.ai
SA=github-deployer@$PROJECT_ID.iam.gserviceaccount.com
gcloud config set project $PROJECT_ID
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com
```

The robot account and what it may do:

```bash
gcloud iam service-accounts create github-deployer --display-name="GitHub Actions deployer"
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role=roles/firebasehosting.admin --condition=None
gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA" --role=roles/serviceusage.serviceUsageConsumer --condition=None
```

Trust GitHub's tokens, but only from this repository:

```bash
gcloud iam workload-identity-pools create github --location=global --display-name="GitHub"
gcloud iam workload-identity-pools providers create-oidc vaultdoc-repo \
  --location=global --workload-identity-pool=github --display-name="VaultDoc repo" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.environment=assertion.environment" \
  --attribute-condition="assertion.repository=='$REPO'"
```

Let only jobs in the `production` environment act as the robot (the provider above already limits
tokens to this repo; `production` needs your approval and only allows main). Wait a minute after
creating the service account, or this says it doesn't exist:

```bash
gcloud iam service-accounts add-iam-policy-binding $SA --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.environment/production"
```

Print the two values GitHub needs:

```bash
echo "GCP_WORKLOAD_IDENTITY_PROVIDER = projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/vaultdoc-repo"
echo "GCP_SERVICE_ACCOUNT = $SA"
```

### 2. GitHub environment with approval

Repo → Settings → Environments → New environment → `production`:

- Deployment protection rules → tick **Required reviewers**, add yourself → Save protection rules.
- Deployment branches and tags → **Selected branches and tags** → add `main`.
- Environment variables → add the two values printed above
  (`GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT`).

### 3. First deploy

Merge `.github/workflows/deploy.yml` into main. CI runs; when it passes, the Actions tab shows
**Deploy · Waiting**, and GitHub emails you. Open it → Review deployments → tick production → Approve.

## Day to day

- Merge to main → approve when asked. To keep a push off the live site, click Reject (or leave it;
  the request expires after 30 days).
- Redeploy without a new commit: Actions → Deploy → Run workflow.
- History: repo home page → Deployments (right side), or Firebase console → Hosting → release history
  (messages "GitHub <commit>"). Rolling back: Firebase console → Hosting → the older release → Rollback.

## If something fails

- `Permission 'iam.serviceAccounts.getAccessToken' denied` (in "Sign in to Google Cloud"): the
  `workloadIdentityUser` binding is missing (re-run that command, wait 1–2 minutes, Re-run jobs), or the job
  isn't in the `production` environment. Check with
  `gcloud iam service-accounts get-iam-policy github-deployer@vaultdoc-ai.iam.gserviceaccount.com`.
  (This is what happened on the first deploy, 24 Oct 2026.)
- `unauthorized_client`: the token came from another repo, or the repo name in the provider's condition
  doesn't match exactly (case matters).
- `Failed to authenticate, have you run firebase login?`: Firebase hides the Google error; the sign-in step
  uses `token_format: access_token` so the real reason shows there instead.
- `403 ... firebasehosting`: the robot is missing `roles/firebasehosting.admin`.
- Org policy errors when creating the pool or the service account: the nitp.ac.in organisation blocks it;
  ask its admin or move the project to a personal account.
