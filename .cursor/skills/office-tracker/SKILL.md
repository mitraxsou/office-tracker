---
name: office-tracker
description: >-
  PwC Office Pulse pilot app (5-hour office tracking on PwC laptops). Covers
  Next.js/Vercel app, Windows agent, admin RBAC, Wi-Fi detection, security, and
  deploy. Use when developing, fixing, or extending Office Tracker / Office Pulse
  in this repo.
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

- PwC colors: orange `#FD5108`, dark `#1A1A1A` / `#2D2D2D`
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

## Development checklist

Before calling work done:

1. `npm test` (8+ tests)
2. `npm run build`
3. Agent `-DryRun` shows SSID via NetConnectionProfile on PwC laptop
4. No PowerShell window flash (VBS task verified)
5. User vs admin permissions unchanged unless requested
6. Copy/install commands use `NEXT_PUBLIC_APP_URL`

## Git commits / deploy

Vercel blocks commits not authored by **mitraxsou**. Always commit with:

```bash
git -c user.name="mitraxsou" -c user.email="16998608+mitraxsou@users.noreply.github.com" commit -m "your message"
```

- Never use `SoumitraPWC` or other authors for production pushes
- Do **not** permanently update `git config user.name` / `user.email` in this repo

## Deploy checklist (Vercel)

**Two projects** (see `docs/deploy-branches.md`):

| Project | Branch | URL |
|---|---|---|
| `office-tracker-dev` | `dev` | https://office-tracker-dev.vercel.app |
| `office-tracker` | `production` | https://office-tracker-theta.vercel.app |

1. Push/merge to the correct branch (not `main`)
2. **Storage → Postgres** per project via `npx vercel integration add neon` (no env prefix). Prod DB vars must be **Production-only** on `office-tracker`
3. Manual env per project: `AUTH_SECRET` (separate secrets), `NEXT_PUBLIC_APP_URL`, `BREAKGLASS_*`, `ALLOW_REGISTRATION=false`, `DEFAULT_OFFICE_SSIDS`, `RUN_DB_SETUP_ON_DEPLOY=true` on dev
4. `prisma` provider **postgresql**; schema uses `POSTGRES_PRISMA_URL` + `POSTGRES_URL_NON_POOLING`
5. Release: PR `dev` → `production` only after review
6. Agent install commands on laptops use **production** `NEXT_PUBLIC_APP_URL` only
7. Production branches verified: `production` on `office-tracker`, `dev` on `office-tracker-dev` — see `docs/deploy-branches.md`

## Common pitfalls

- **Empty dashboard:** agent not installed or no heartbeats yet; browser cannot see Wi-Fi
- **SSID none:** Location blocked; ensure NetConnectionProfile path in agent
- **CSS broken:** verify `globals.css` has `@import "tailwindcss"`, clear `.next`, restart dev server
- **401 heartbeat:** token regenerated without re-install; serial mismatch on wrong laptop
- **Vercel deploy fails immediately (Hobby):** cron expressions more frequent than once per day are rejected (`*/15 * * * *`, `0 * * * *`). Keep `vercel.json` crons daily or weekly.
- **Git review tools fail:** need at least one commit; use full codebase read for initial audit

## Additional resources

- Full env and API list: [reference.md](reference.md)
