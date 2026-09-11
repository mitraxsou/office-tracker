# Dev / production deployment workflow

Office Pulse uses **Enterprise CDTR** for active deploys. Git branches `dev` and `production` map to separate Vercel projects so development never shares the production database.

Cursor agents: see `.cursor/skills/office-tracker/SKILL.md` section **After feature work** for the push, merge, and CLI deploy checklist.

## Enterprise CDTR (`pwc-us-adv-cdtr`) - active

| Environment | Git branch | Vercel project | URL | Database |
|---|---|---|---|---|
| **Development** | `dev` | `office-tracker-dev-9824` | https://office-tracker-dev-9824.vercel.app | Same Neon as Hobby dev |
| **Production** | `production` | `office-tracker-prod` | https://office-tracker-prod.vercel.app | Same Neon as Hobby prod (`neon-canary-blanket`) |

### Git commit author (Enterprise deploy gate)

Enterprise blocks git-triggered deploys when the **commit author** is not a recognized team member. Commits from this repo should use the PwC-linked Vercel identity:

```powershell
git config --local user.name "soumitrammandal-4446"
git config --local user.email "soumitra.m.mandal@pwc.com"
```

Also link the same email in [Vercel Account Settings](https://vercel.com/account) and connect your GitHub login there. If git deploys stay `Blocked`, use CLI deploy (see below) or ask a team admin to approve the committer.

### CLI deploy when git deploy is blocked

```powershell
$env:VERCEL_ORG_ID = "team_aibOHBi06MpPxWdFWRGDp9iK"
$env:VERCEL_PROJECT_ID = "prj_lhha3DVceqlTtU2A4HGdNaM32Sk6"   # dev
npx vercel deploy --prod --yes
$env:VERCEL_PROJECT_ID = "prj_N8idhB3WNItVngojCQAmOT5bsnSI"   # prod
npx vercel deploy --prod --yes
```

## Hobby (`soumitra-pwc`) - paused

Hobby projects are **paused** during the Enterprise pilot. Do not deploy here.

| Environment | Git branch | Vercel project | URL | Database |
|---|---|---|---|---|
| **Development** | `dev` (GitHub default) | `office-tracker-dev` | https://office-tracker-dev.vercel.app | Vercel Storage Neon `office-tracker-dev-db` |
| **Production** | `production` | `office-tracker` | https://office-tracker-theta.vercel.app | Vercel Storage Neon `neon-canary-blanket` |

Pause or disconnect Hobby so pushes to `dev` / `production` do not deploy there:

1. Open [Vercel dashboard](https://vercel.com) under team **soumitra-pwc**.
2. For **office-tracker** and **office-tracker-dev**: Settings → General → **Pause Project** (or disconnect Git in Settings → Git).
3. Or run `.\scripts\pause-hobby-projects.ps1` with a token scoped to `soumitra-pwc`.

Env vars for Enterprise (same Neon as Hobby; no Storage UI):

```powershell
$env:VERCEL_TOKEN = "your-token"   # session only
# OTP login requires POWER_AUTOMATE_WEBHOOK_SECRET (copy from Hobby office-tracker or Power Automate):
$env:POWER_AUTOMATE_WEBHOOK_SECRET = "paste-secret-here"
.\scripts\sync-enterprise-env.ps1 -Profile dev
.\scripts\sync-enterprise-env.ps1 -Profile prod
```

`sync-enterprise-env.ps1` **never rotates** `AUTH_SECRET` when it is already set on Vercel and not in your local env files. After first Enterprise deploy, save the session secret locally:

```powershell
.\scripts\pull-enterprise-auth-secret.ps1 -Profile prod
.\scripts\pull-enterprise-auth-secret.ps1 -Profile dev
```

Then redeploy both Enterprise projects (CLI deploy or Vercel dashboard). Redeploy alone does not log users out if `AUTH_SECRET` stays unchanged.

Set **Production Branch** in each Enterprise project's Git settings: `dev` for `office-tracker-dev-9824`, `production` for `office-tracker-prod` (dashboard only; API cannot change this on Enterprise).

The legacy `main` branch is frozen at the same commit as `dev` / `production` when the split was created. Do not deploy from `main`.

## Verified setup (2026-09-09)

| Check | Status |
|---|---|
| `office-tracker` production branch | `production` (API: `link.productionBranch`) |
| `office-tracker-dev` production branch | `dev` |
| GitHub default branch | `dev` |
| Dev URL | https://office-tracker-dev.vercel.app/login — Ready |
| Prod URL | https://office-tracker-theta.vercel.app/login — Ready |
| Prod DB vars | Production scope only (no Preview credentials) |
| Dev DB | Separate Neon (`office-tracker-dev-db`) |

If branch tracking is ever reset, set **Production Branch** in each project's Git settings (dashboard). The public link API may not persist `productionBranch` changes; use the dashboard if auto-deploy stops after pushes.

## Day-to-day workflow

1. **Feature work** - branch from `dev`, open PR into `dev`.
2. **Dev deploy** - merge to `dev` auto-deploys **office-tracker-dev-9824** on Enterprise.
3. **Release** - open PR from `dev` into `production`. Merge only after review.
4. **Prod deploy** - merge to `production` auto-deploys **office-tracker-prod** on Enterprise.

Do not merge to `production` without explicit approval. Hobby projects should stay paused.

## Vercel project settings

| Setting | `office-tracker` (prod) | `office-tracker-dev` (dev) |
|---|---|---|
| Production branch | `production` | `dev` |
| Framework | Next.js | Next.js |
| Team | `soumitra-pwc` | `soumitra-pwc` |

Confirmed via `GET /v9/projects/{projectId}` on 2026-09-09. If auto-deploy breaks after a Git reconnect, re-check **Production Branch** in the dashboard.

## Databases (Vercel Storage only)

Both databases were created with the Vercel CLI Neon integration (no manual Neon dashboard, no `neonctl`):

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:VERCEL_PROJECT_ID = "prj_8e1WU41N2AV7BIaKDydrmeQ6oL2x"   # office-tracker-dev
$env:VERCEL_ORG_ID = "team_3LPxagkp9owYBE8nVXkQAg7H"
npx vercel integration add neon -e production -m region=sin1 -m auth=false --plan free_v3 --name office-tracker-dev-db
```

Production keeps the existing resource **`neon-canary-blanket`** on **`office-tracker`**. All `POSTGRES_*`, `DATABASE_*`, `PG*`, and `NEON_*` vars on that project are scoped to **Production only** (Preview has no DB credentials).

Dev project vars are on **Production** scope of `office-tracker-dev` (that project's only deployment target).

## Environment variables

### `office-tracker` (production project)

| Variable | Scope | Notes |
|---|---|---|
| `POSTGRES_*`, `DATABASE_*`, `PG*`, `NEON_*` | Production only | From Storage `neon-canary-blanket` |
| `NEXT_PUBLIC_APP_URL` | Production only | `https://office-tracker-theta.vercel.app` |
| `AUTH_SECRET` | Production only | Prod-only secret (regenerated during split; users must sign in again) |
| `RUN_DB_SETUP_ON_DEPLOY` | Production only | `true` during pilot; set `false` when schema is stable |
| `SCHEMA_AUTO_MIGRATE` | Production only | Set `false` on prod to skip startup ALTER TABLE block (saves cold-start CPU) |
| `BREAKGLASS_*`, `ALLOW_REGISTRATION`, `DEFAULT_OFFICE_SSIDS` | Production only | Same as before |
| `POWER_AUTOMATE_WEBHOOK_URL` | Production only | OTP / Teams (shared PA flow URL) |
| `POWER_AUTOMATE_WEBHOOK_SECRET` | Production only | `X-Office-Pulse-Token` header (required; survives AUTH_SECRET rotation) |

### `office-tracker-dev` (dev project)

| Variable | Scope | Notes |
|---|---|---|
| `POSTGRES_*`, etc. | Production | From Storage `office-tracker-dev-db` |
| `NEXT_PUBLIC_APP_URL` | Production | `https://office-tracker-dev.vercel.app` |
| `AUTH_SECRET` | Production | Separate dev secret |
| `RUN_DB_SETUP_ON_DEPLOY` | Production | `true` (schema + seed on deploy) |
| `SCHEMA_AUTO_MIGRATE` | Production | unset (migrate on cold start); set `false` on prod when stable |
| `BREAKGLASS_*` | Production | Copied for dev login testing |
| `POWER_AUTOMATE_WEBHOOK_URL` | Production | Same PA flow URL as prod (pilot shares one flow) |
| `POWER_AUTOMATE_WEBHOOK_SECRET` | Production | Same header secret as prod (required for OTP/Teams on dev) |
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
