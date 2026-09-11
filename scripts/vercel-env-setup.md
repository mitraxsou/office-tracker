# Vercel env cleanup (no CLI login)

## Pause non-production projects

The Vercel CLI can fail behind PwC SSL inspection. The pause script uses `curl.exe` and keeps
`office-tracker` active:

```powershell
$env:VERCEL_TOKEN = "your-token-from-vercel-account-tokens"
# Add this only when the projects belong to a team:
# $env:VERCEL_TEAM_ID = "team_xxxxxxxxx"

.\scripts\pause-vercel-projects.ps1 -WhatIf
.\scripts\pause-vercel-projects.ps1
```

The script first verifies that exactly one accessible project is named `office-tracker`. It then
pauses every other active project. `VERCEL_TOKEN` is kept in the PowerShell session only.

On PwC laptops, `npx vercel login` often fails with:

```text
self-signed certificate in certificate chain
```

Use the **Vercel REST API** with a token created in the browser. The cleanup script uses **`curl.exe`** (Windows system certificate store), which usually works behind corporate SSL inspection.

## 1. Create an access token (browser only)

1. Open [vercel.com/account/tokens](https://vercel.com/account/tokens) in your browser (already works on PwC network).
2. Click **Create Token**.
3. Name it e.g. `office-tracker-env-cleanup`.
4. Scope: full account access (or at least project env read/write).
5. Copy the token — shown once.

Do **not** commit the token or add it to `.env` files in git.

## 2. Find your project ID

**Option A — Dashboard URL**

1. Open [vercel.com/dashboard](https://vercel.com/dashboard).
2. Open project **office-tracker**.
3. **Settings → General → Project ID** — copy `prj_...`.

**Option B — Settings URL**

```text
https://vercel.com/<team-or-user>/office-tracker/settings
```

Project ID is on the General settings page.

**Option C — Linked repo**

If you previously ran `npx vercel link` on a machine without SSL issues, `.vercel/project.json` contains `projectId` and `orgId` (team). The script reads this automatically.

## 3. Run the cleanup script

From the repo root in **PowerShell**:

```powershell
cd "C:\Users\smandal089\OneDrive - PwC\Documents\Cursor\OfficeTracker"

# Paste token (session only — not saved to disk)
$env:VERCEL_TOKEN = "your_token_here"

# Optional if not in .vercel/project.json
$env:VERCEL_PROJECT_ID = "prj_xxxxxxxxxxxxxxxx"
# Optional for team projects
$env:VERCEL_TEAM_ID = "team_xxxxxxxxxxxxxxxx"

# Preview what will be deleted (no changes)
.\scripts\cleanup-vercel-env.ps1 -WhatIf

# Delete misconfigured vars
.\scripts\cleanup-vercel-env.ps1
```

### What gets deleted

| Rule | Example |
|------|---------|
| Any key starting with `DATABASE_URL_` | `DATABASE_URL_POSTGRES_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL_NEON_PROJECT_ID`, … |
| `DATABASE_URL` if value is **not** `postgresql://…` or `postgres://…` | Pasted shell commands, empty/encrypted garbage |
| **Kept:** plain `DATABASE_URL` with a valid Postgres URL | Manual legacy alias (optional) |

### What should remain after Storage reconnect

| Variable | Source |
|----------|--------|
| `POSTGRES_URL` | Vercel Storage → Postgres |
| `POSTGRES_PRISMA_URL` | Vercel Storage → Postgres |
| `POSTGRES_URL_NON_POOLING` | Vercel Storage → Postgres |
| `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`, … | Manual project vars |

## 4. Reconnect Storage (dashboard — required)

The API can **delete** env vars; it cannot re-link Storage. After cleanup:

1. Vercel project → **Storage** tab.
2. Select your **Postgres** database (Neon).
3. **Connect to Project** (or **Disconnect** then reconnect).
4. When asked for **env var prefix**, leave it **blank** — do **not** enter `DATABASE_URL`.
5. Confirm these appear under **Settings → Environment Variables** (no prefix):
   - `POSTGRES_URL`
   - `POSTGRES_PRISMA_URL`
   - `POSTGRES_URL_NON_POOLING`
6. **Deployments → … → Redeploy** production.

See also [README.md](../README.md) section *Fix misconfigured Storage prefix*.

## 5. Verify with curl (optional)

```powershell
$env:VERCEL_TOKEN = "your_token_here"
$project = "prj_xxxxxxxx"   # or office-tracker
$team = "team_xxxxxxxx"     # omit for personal account

curl.exe -sS `
  -H "Authorization: Bearer $env:VERCEL_TOKEN" `
  "https://api.vercel.com/v10/projects/$project/env?teamId=$team" |
  ConvertFrom-Json |
  ForEach-Object { $_.key } |
  Sort-Object -Unique
```

## 6. Fix Vercel CLI SSL on PwC laptops (Node)

`npx vercel login` and `npx vercel --token ...` fail with `self-signed certificate in certificate chain` because Node does not use the Windows cert store.

**One-time export** (captures the PwC proxy chain from `api.vercel.com`):

```powershell
.\scripts\export-pwc-proxy-ca.ps1
```

**Each PowerShell session** (before `npx vercel`):

```powershell
$env:NODE_EXTRA_CA_CERTS = "C:\Users\smandal089\OneDrive - PwC\Documents\Cursor\OfficeTracker\.certs\pwc-proxy.pem"
$env:VERCEL_TOKEN = "your_token_here"   # session only — do not commit
npx vercel whoami
npx vercel env pull .env.vercel.local
```

**Persistent (optional):** Windows → Environment Variables → User → `NODE_EXTRA_CA_CERTS` = path to `.certs\pwc-proxy.pem`. Keep `VERCEL_TOKEN` as a session variable or Windows user env var — **not** in `.env` (that file is for the Next.js app).

Do **not** set `NODE_TLS_REJECT_UNAUTHORIZED=0` unless you accept disabling all TLS checks.

For `curl.exe` without `--ssl-no-revoke`, import the corp root into **Windows Trusted Root Certification Authorities** (IT often does this via group policy).

## 7. Revoke the token

After cleanup and Storage reconnect:

1. [vercel.com/account/tokens](https://vercel.com/account/tokens)
2. Delete `office-tracker-env-cleanup`.

## PwC Enterprise (`pwc-us-adv-cdtr`) without Storage / env UI

On the CDTR Enterprise team, **v0 Builder** roles often cannot open **Storage** or **Environment Variables** in the dashboard, but the **REST API still accepts env var writes** (201/200). Use that to point an Enterprise project at the **same Hobby Neon database** you already use on `office-tracker-dev`.

### Projects (dev and prod separate)

| Profile | Project | URL | Git branch | Database |
|---------|---------|-----|------------|----------|
| `dev` | `office-tracker-dev-9824` | https://office-tracker-dev-9824.vercel.app | `dev` | Same Neon as Hobby `office-tracker-dev` |
| `prod` | `office-tracker-prod` | https://office-tracker-prod.vercel.app | `production` | Same Neon as Hobby `office-tracker` (`neon-canary-blanket`) |

Team: `pwc-us-adv-cdtr` (`team_aibOHBi06MpPxWdFWRGDp9iK`).

### One-time sync (no secrets in git)

1. Local env files (gitignored):
   - **Dev:** `.env.vercel.dev.local` from Hobby `office-tracker-dev` (`npx vercel env pull`)
   - **Prod:** `.env.vercel.local` (Neon from Hobby `office-tracker` Storage) + `.env.vercel.prod.local` (app vars)

2. Sync both Enterprise projects:

   ```powershell
   $env:VERCEL_TOKEN = "your-token"   # session only
   .\scripts\sync-enterprise-env.ps1 -Profile dev
   .\scripts\sync-enterprise-env.ps1 -Profile prod
   ```

3. In Vercel dashboard → each project → **Git → Production Branch**:
   - `office-tracker-dev-9824` → `dev`
   - `office-tracker-prod` → `production`

4. Workflow: merge to `dev` → dev URL updates; when ready, PR `dev` → `production` → prod URL updates.

**Do not** commit database URLs or `AUTH_SECRET` to git. Admin Settings in the app already edits runtime pilot config (SSIDs, hours target, etc.) in Postgres; connection strings belong in Vercel env only.

### Re-sync after Hobby env changes

Re-run `.\scripts\sync-enterprise-env.ps1` whenever you rotate `AUTH_SECRET` or Neon credentials on Hobby.

## Troubleshooting

| Error | Fix |
|-------|-----|
| `401 Unauthorized` | Token expired or wrong — create a new token |
| `403 Forbidden` | Token lacks access — use account token or team member with env permissions |
| `404 Project not found` | Wrong `VERCEL_PROJECT_ID` or missing `VERCEL_TEAM_ID` for team projects |
| `curl.exe failed` | Corporate proxy blocking `api.vercel.com` — try from personal network or ask IT |
| Vars deleted but app still broken | Reconnect Storage (step 4) and redeploy |
| Enterprise build: `POSTGRES_PRISMA_URL` not found | Run `sync-enterprise-env.ps1`, then redeploy |
| Enterprise URL redirects to Vercel SSO | Expected for protected Enterprise deployments — open in browser while signed into PwC Vercel |
