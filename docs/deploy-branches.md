# Dev / production deployment workflow

Office Pulse uses **two Vercel projects** and **two Git branches** so development never shares the production database.

| Environment | Git branch | Vercel project | URL | Database |
|---|---|---|---|---|
| **Development** | `dev` (GitHub default) | `office-tracker-dev` | https://office-tracker-dev.vercel.app | Vercel Storage Neon `office-tracker-dev-db` |
| **Production** | `production` | `office-tracker` | https://office-tracker-theta.vercel.app | Vercel Storage Neon `neon-canary-blanket` |

The legacy `main` branch is frozen at the same commit as `dev` / `production` when the split was created. Do not deploy from `main`.

## Day-to-day workflow

1. **Feature work** - branch from `dev`, open PR into `dev`.
2. **Dev deploy** - merge to `dev` auto-deploys **office-tracker-dev** (production deployment of that project).
3. **Release** - open PR from `dev` into `production`. Merge only after review.
4. **Prod deploy** - merge to `production` auto-deploys **office-tracker** (theta URL).

Do not merge to `production` without explicit approval.

## Vercel project settings

| Setting | `office-tracker` (prod) | `office-tracker-dev` (dev) |
|---|---|---|
| Production branch | `production` | `dev` |
| Framework | Next.js | Next.js |
| Team | `soumitra-pwc` | `soumitra-pwc` |

To change the production branch via API (undocumented but used by the dashboard):

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
# PATCH https://api.vercel.com/v9/projects/{projectId}/branch?teamId=team_3LPxagkp9owYBE8nVXkQAg7H
# Body: {"branch":"production"} or {"branch":"dev"}
```

Or: Project Settings - Environments - Production - Branch Tracking.

## Databases (Vercel Storage only)

Both databases were created with the Vercel CLI Neon integration (no manual Neon dashboard, no `neonctl`):

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:VERCEL_PROJECT_ID = "prj_8e1WU41N2AV7BIaKDydrmeQ6oL2x"   # office-tracker-dev
$env:VERCEL_ORG_ID = "team_3LPxagkp9owYBE8nVXkQAg7H"
npx vercel integration add neon -e production -m region=iad1 -m auth=false --plan free_v3 --name office-tracker-dev-db
```

Production keeps the existing resource **`neon-canary-blanket`** on **`office-tracker`**. All `POSTGRES_*`, `DATABASE_*`, `PG*`, and `NEON_*` vars on that project are scoped to **Production only** (Preview has no DB credentials).

Dev project vars are on **Production** scope of `office-tracker-dev` (that project's only deployment target).

## Environment variables

### `office-tracker` (production project)

| Variable | Scope | Notes |
|---|---|---|
| `POSTGRES_*`, `DATABASE_*`, `PG*`, `NEON_*` | Production only | From Storage `neon-canary-blanket` |
| `NEXT_PUBLIC_APP_URL` | Production only | `https://office-tracker-theta.vercel.app` |
| `AUTH_SECRET` | Production only | Prod-only secret |
| `RUN_DB_SETUP_ON_DEPLOY` | Production only | `true` during pilot |
| `BREAKGLASS_*`, `ALLOW_REGISTRATION`, `DEFAULT_OFFICE_SSIDS` | Production only | Same as before |
| `POWER_AUTOMATE_WEBHOOK_URL` | Production only | OTP / Teams |

### `office-tracker-dev` (dev project)

| Variable | Scope | Notes |
|---|---|---|
| `POSTGRES_*`, etc. | Production | From Storage `office-tracker-dev-db` |
| `NEXT_PUBLIC_APP_URL` | Production | `https://office-tracker-dev.vercel.app` |
| `AUTH_SECRET` | Production | Separate dev secret |
| `RUN_DB_SETUP_ON_DEPLOY` | Production | `true` (schema + seed on deploy) |
| `BREAKGLASS_*` | Production | Copied for dev login testing |
| `ALLOW_REGISTRATION`, `DEFAULT_OFFICE_SSIDS` | Production | Same values as prod |

## GitHub branch protection

Branch protection on `production` requires GitHub Pro for private repos (403 on this repo). Use manual discipline: always release via PR `dev` -> `production`, never push directly.

## Local development

Unchanged: Neon or local Postgres via `.env.local`, `npm run dev` on http://localhost:3000.

## PwC laptop CLI notes

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:VERCEL_ORG_ID = "team_3LPxagkp9owYBE8nVXkQAg7H"
$env:VERCEL_PROJECT_ID = "prj_Ay5vp88pkSDFYURvoX9zCip4k72c"   # or dev project id
npx vercel env ls
```

Project IDs:

- Production: `prj_Ay5vp88pkSDFYURvoX9zCip4k72c`
- Development: `prj_8e1WU41N2AV7BIaKDydrmeQ6oL2x`
