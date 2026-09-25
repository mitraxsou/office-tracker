---
name: office-tracker
description: >-
  PwC Office Pulse pilot app (5-hour office tracking on PwC laptops). Covers
  Next.js/Vercel app, Windows agent, admin RBAC, Wi-Fi detection, security,
  deploy, and Vercel deploy failure verification. Use when developing, fixing,
  or extending Office Tracker / Office Pulse in this repo.
---

# PwC Office Pulse (Office Tracker)

Internal pilot: track **≥5 hours/day in office** on PwC laptops, with a default **8 office days per month** target. Product name in UI and agent: **PwC Office Pulse**.

## Architecture

```
Windows agent (PwC Office Pulse) → POST /api/heartbeat → Neon Postgres (Vercel)
Web dashboard ← session cookie              Admin /admin ← role=admin
Config: GET /api/agent/config (Bearer token) — SSIDs & hours target server-side only
```

- **Local dev:** Postgres via `.env.local`, `npm run dev` → http://localhost:3000
- **Dev (Hobby):** `dev` → `office-tracker-dev` → https://office-tracker-dev.vercel.app
- **Prod (Hobby):** `production` → `office-tracker` → https://office-tracker-theta.vercel.app
- **Dev (Enterprise CDTR):** `dev` → `office-tracker-dev-9824` → https://office-tracker-dev-9824.vercel.app (same Neon as Hobby dev)
- **Prod (Enterprise CDTR):** `production` → `office-tracker-prod` → https://office-tracker-prod.vercel.app (same Neon as Hobby prod)
- **Enterprise env sync:** `.\scripts\sync-enterprise-env.ps1 -Profile dev|prod` — see `scripts/vercel-env-setup.md` and `docs/deploy-branches.md`
- **SSO bypass for agent updates:** `.\scripts\setup-automation-bypass.ps1 -SyncEnv` — sets `VERCEL_AUTOMATION_BYPASS_SECRET` on both Enterprise projects; clients use header `x-vercel-protection-bypass`
- **Workflow:** PR to `dev`, then PR `dev` → `production`. GitHub default branch is `dev`. See `docs/deploy-branches.md`
- **Do not** reuse `lsc-impact-analyser-dashboard` Vercel project or point dev at prod Postgres

## Office presence rules

| Counts as in-office | Does NOT count |
|---|---|
| Wi-Fi SSID **OfficeConnect**, **ExternalConnect**, or **pwcglb.com** (admin global allowlist) | GlobalProtect/VPN (always on at home and office) |
| Manual visit / quick check-in | Public IP, gateway name |
| Admin-corrected visits | Unknown SSID |

- Heartbeat every **5 min by default** (admin configurable 2-60); gap **>15 min** ends visit
- Timezone default: **Asia/Kolkata**
- `vpnGateway` in heartbeat is **diagnostic only**

## Windows agent (`agent/`)

**No admin required** by default. Install to `%LOCALAPPDATA%\OfficeTracker\`.

| File | Role |
|---|---|
| `install.ps1` | User-level install; optional `-RequireAdmin` for Program Files |
| `office-heartbeat.ps1` | SSID + serial + POST heartbeat |
| `run-heartbeat.vbs` | Hidden runner (no PowerShell popup) |
| `uninstall.ps1` | Remove task, Startup shortcut, local files |
| `update.ps1` | Refresh scripts; task name **PwCOfficePulse** |

**Scheduled task:** `PwCOfficePulse` wakes every 2 min and sends only after the server-configured interval + Startup shortcut at logon.

**SSID detection order** (PwC laptops often block Location by admin):
1. `netsh wlan show interfaces` (actual WLAN SSID; prefer connected interface)
2. **`Get-NetConnectionProfile`** only when netsh has no valid SSID (may show captive portal domain like `pwcglb.com`, not the WLAN name `ExternalConnect`)
3. WMI fallback if needed

Normalize before send: strip ` (Unauthenticated)`, band suffixes (` 2`, ` 5`), and skip transient names like `Identifying...`.

**Identity on agent:** `token` + `serialNumber` (BIOS via `Get-CimInstance Win32_Bios`). Multiple laptops per user via `AgentDevice` table (auto-register, admin can remove).

**Install UX:** Users download agent zip from Settings (`GET /api/agent/download`, session required). **Copy install command** and **Copy update command** embed token + `NEXT_PUBLIC_APP_URL` with relative `.\install.ps1` / `.\update.ps1`. Commands must run from the extract folder (PowerShell, not cmd.exe). Downloads on PwC laptops is often `OneDrive - PwC\Downloads`; zip `PwCOfficePulse-agent` may nest `PwCOfficePulse`.

**Setup Int32 / corrupt `version.txt`:** If update fails with `Cannot convert value "000…" to type System.Int32`, dump and remove `%LOCALAPPDATA%\OfficeTracker\version.txt`, then re-paste the update command — see `docs/agent-setup-recovery.md`. Agent **1.5.2+** hardens version compare, removes script-level `param()` from `setup.ps1`, and uses `Invoke-AgentScriptBypass` so `$ApiUrl` / `$Token` are not nulled on fresh install.

## Roles

### User (`role=user`)
- `/dashboard`, `/history`, `/settings`, `/help`
- Settings: timezone, token, install/uninstall commands, read-only hours and monthly days targets, read-only registered laptops
- Cannot edit SSIDs, daily target, or device serials
- Quick **Check in** / **Check out** when auto-detect fails

### Admin (`role=admin`)
- `/admin` — all users, compliance charts, visit corrections, device removal
- `/admin/settings` — global hours target, monthly office days target, office SSIDs
- Audit log on admin actions

**Breakglass admin:** env vars `BREAKGLASS_EMAIL` + `BREAKGLASS_PASSWORD` only (not hardcoded in source). Local dev example in `.env.local`.

## Security (must preserve)

- Agent tokens: **bcrypt hashes** in DB; plain token shown once via short-lived cookie flow
- `/api/heartbeat`: rate limit (~30s), validate SSID/serial/timestamp length
- `/api/agent/config`: **Bearer header only** (no token in query string)
- `/api/agent/download`: authenticated session required
- `install-command` must **not** silently regenerate tokens
- `ALLOW_REGISTRATION=false` in production
- Admin routes: `requireAdmin()` on all `/api/admin/*`
- Never commit `.env.local`, `*.db`, or secrets
- Security headers in `next.config.ts`

See [reference.md](reference.md) for env vars and API routes.

## UI / copy / code style

- PwC colors: orange `#FD5108`, dark `#1A1A1A` / `#2D2D2D`. For muted washes, accent rails, chips, buttons, light/dark alphas, and when not to invent hues, use the **pwc-colors** skill (`.cursor/skills/pwc-colors/SKILL.md`)
- **No em dashes (—) anywhere** in the repo: user-facing copy, comments, commit messages, error strings, docs, or UI labels. Use a hyphen (`-`), comma, colon, or parentheses instead.
- No ChatGPT tone ("seamlessly", "leverage", "robust")
- Direct internal IT voice; verb-first buttons ("Copy install command", "Check in")
- Do not tell users to enable Location when IT has disabled it; mention alternate SSID detection

## Key paths

| Area | Path |
|---|---|
| API routes | `src/app/api/` |
| Auth / breakglass | `src/lib/auth.ts`, `src/lib/breakglass.ts`, `src/lib/agent-auth.ts` |
| Heartbeat logic | `src/lib/heartbeat-service.ts`, `src/lib/visits.ts` |
| Admin reports | `src/lib/admin-reports.ts`, `src/components/AdminDashboard.tsx` |
| Agent branding | `src/lib/agent-branding.ts` |
| Schema | `prisma/schema.prisma` |
| Tests | `tests/visits.test.ts`, `tests/ssid.test.ts` |
| Bug / regression catalog | `tests/bugs/catalog.json` (`npm run test:bugs`) |

## Development checklist

Before calling work done:

1. `npm test` (includes `tests/bugs/`)
2. `npm run test:bugs` (regression catalog - run even if the change seems unrelated)
3. `npm run build`
4. Agent `-DryRun` shows SSID via NetConnectionProfile on PwC laptop
5. No PowerShell window flash (VBS task verified)
6. User vs admin permissions unchanged unless requested
7. Copy/install commands use `NEXT_PUBLIC_APP_URL`

## Regression catalog

Past incidents and core guards live under `tests/bugs/` (`catalog.json` + fixtures + Vitest).

- **When making any change** (related or not): run `npm run test:bugs` before calling work done.
- **Add a case:** see `tests/bugs/README.md` (catalog entry + failing-then-passing test + sanitized fixture).
- Agent laptop matrix (separate harness): `docs/agent-regression-matrix.md` / `npm run test:regression`.

## Git commits

Enterprise git deploys require commits authored by the PwC-linked Vercel identity. Use per-commit flags (do **not** permanently update `git config`):

```bash
git -c user.name="soumitrammandal-4446" -c user.email="soumitra.m.mandal@pwc.com" commit -m "your message"
```

- Do **not** auto-commit unless the user explicitly asks
- Never use `SoumitraPWC`, `soumitra-dan`, or other authors for pushes that should deploy
- Hobby deploys used `mitraxsou`; Enterprise uses the PwC email above (see `docs/deploy-branches.md`)

## After feature work (Enterprise deploy checklist)

When the user says **deploy**, **commit and deploy**, or approves release after feature work, run the full pipeline below. Do **not** deploy to paused Hobby projects (`soumitra-pwc` / `office-tracker-dev` / `office-tracker`).

### 1. Git (if commits are ready)

```powershell
git push origin dev
git checkout production
git pull origin production
git merge dev
git push origin production
git checkout dev
```

### 2. CLI deploy (git-triggered deploys are often BLOCKED on Enterprise)

Requires `VERCEL_TOKEN` in the PowerShell session (https://vercel.com/account/tokens, scoped to `pwc-us-adv-cdtr`).

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:VERCEL_ORG_ID = "team_aibOHBi06MpPxWdFWRGDp9iK"
$env:VERCEL_TOKEN = "your-token"   # session only, never commit

# Dev (branch dev)
$env:VERCEL_PROJECT_ID = "prj_lhha3DVceqlTtU2A4HGdNaM32Sk6"
npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN

# Prod (branch production)
$env:VERCEL_PROJECT_ID = "prj_N8idhB3WNItVngojCQAmOT5bsnSI"
npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN
```

### 3. Verify

Confirm both deployments are **READY** and aliased:

| Environment | Project | URL |
|---|---|---|
| Dev | `office-tracker-dev-9824` | https://office-tracker-dev-9824.vercel.app |
| Prod | `office-tracker-prod` | https://office-tracker-prod.vercel.app |

Use the Vercel API or inspector URL from CLI output. Check `/login` returns 200 or SSO redirect.

### 4. Env sync (when vars changed)

- `.\scripts\sync-enterprise-env.ps1 -Profile dev|prod` copies env vars to Enterprise
- Script **never rotates** `AUTH_SECRET` when already set on Vercel (see `scripts/pull-enterprise-auth-secret.ps1`)
- Full branch and project mapping: `docs/deploy-branches.md`

### Rules

- Do **not** deploy Hobby `soumitra-pwc` projects (paused during Enterprise pilot)
- Do **not** merge to `production` without user approval unless they asked to deploy prod
- Agent install commands on laptops use **Enterprise prod** `NEXT_PUBLIC_APP_URL` only
- `prisma` provider **postgresql**; schema uses `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING`

## Vercel deploy failure loop

Run this after any push/deploy, when the user reports a build failed, or before calling deploy **done**. Do not stop at the first failure; iterate until both environments are **READY** or you are blocked (missing user token or permission).

### 1. Check deployment status and logs

| Method | Command / location |
|---|---|
| GitHub (if `gh` linked) | `gh api repos/mitraxsou/office-tracker/deployments --jq '.[0] \| {state, environment, created_at}'` or check the repo Deployments tab |
| Vercel CLI (Hobby) | `npx vercel ls --token $env:VERCEL_TOKEN` |
| Vercel dashboard | Team **soumitra-pwc**, projects **office-tracker** (prod) and **office-tracker-dev** (dev) |
| Failed build logs | `npx vercel inspect <deployment-url> --logs --token $env:VERCEL_TOKEN` or Vercel API |

### 2. Active targets (Hobby; Enterprise sunset)

| Environment | Branch | Project | URL |
|---|---|---|---|
| Dev | `dev` | `office-tracker-dev` | https://office-tracker-dev.vercel.app |
| Prod | `production` | `office-tracker` | https://office-tracker-theta.vercel.app |

Git push to `dev` / `production` triggers Hobby auto-deploy. Commits must use **mitraxsou** author (see [reference.md](reference.md)).

### 3. Common failures in this repo

- **TypeScript / lint errors** during `next build` (fix locally, then `npm test` and `npm run build`)
- **Prerender DB access denied** on `/privacy` (local only without Neon; Vercel has Postgres)
- **Cron more than once per day** on Hobby (`vercel.json`; daily or weekly only)
- **Missing env vars** on Vercel (check Settings → Environment Variables per project)

### 4. Fix loop

1. Read the failed deployment log and identify the error.
2. Fix code in the repo.
3. `npm test` then `npm run build` locally when possible.
4. Commit with mitraxsou author.
5. Push `dev`, then merge and push `production` (or push both as the user requested).
6. Recheck deployment status until **READY** on both dev and prod URLs (`/login` returns 200 or SSO redirect).

### 5. CLI redeploy when git deploy is stuck

Hobby team and project IDs (from `docs/deploy-branches.md`):

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"
$env:VERCEL_ORG_ID = "team_3LPxagkp9owYBE8nVXkQAg7H"
$env:VERCEL_TOKEN = "your-token"   # session only, never commit

# Dev (branch dev)
$env:VERCEL_PROJECT_ID = "prj_8e1WU41N2AV7BIaKDydrmeQ6oL2x"
npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN

# Prod (branch production)
$env:VERCEL_PROJECT_ID = "prj_Ay5vp88pkSDFYURvoX9zCip4k72c"
npx vercel deploy --prod --yes --token $env:VERCEL_TOKEN
```

Prefer git push when auto-deploy works; use CLI only when git-triggered deploys stall or stay in Error state.

## Common pitfalls

- **Empty dashboard:** agent not installed or no heartbeats yet; browser cannot see Wi-Fi
- **SSID none:** Location blocked; ensure NetConnectionProfile path in agent
- **CSS broken:** verify `globals.css` has `@import "tailwindcss"`, clear `.next`, restart dev server
- **401 heartbeat:** token regenerated without re-install; serial mismatch on wrong laptop
- **Vercel deploy fails immediately (Hobby):** cron expressions more frequent than once per day are rejected (`*/15 * * * *`, `0 * * * *`). Keep `vercel.json` crons daily or weekly.
- **Git review tools fail:** need at least one commit; use full codebase read for initial audit

## Additional resources

- Full env and API list: [reference.md](reference.md)
