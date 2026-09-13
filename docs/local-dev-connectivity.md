# Local dev when PwC VPN blocks Neon

PwC GlobalProtect can block direct Postgres connections to Neon (not just TLS). Pick the path that matches your laptop today.

## Recommended default (VPN blocks Neon)

**Option A: Remote API + deployed portal**

1. Copy `.env.remote.example` to `.env.remote.local`
2. Set `OFFICETRACKER_REMOTE_API_URL` to the portal you target:
   - Dev: `https://office-tracker-dev.vercel.app`
   - Prod pilot: `https://office-tracker-theta.vercel.app`
3. Seed demo users when Neon is reachable (home network, split tunnel, or CI):
   - Dev DB: `npm run seed:demo:dev`
   - Prod DB: `$env:CONFIRM_PROD="yes"; npm run seed:demo:prod`
4. Run local simulator: `npm run dev:remote`
5. Open **http://localhost:3000/dev/simulator** to post agent events
6. Open the **deployed portal URL** for dashboards and admin (local `/dashboard` needs a local DB)

What `dev:remote` does:

- Skips local Postgres env check (`OFFICETRACKER_REMOTE_API=1`)
- Runs the agent event simulator locally at `/dev/simulator`
- Simulator posts agent sync to the remote `/api/agent/sync` using tokens from `.demo-users.local.json`
- Use the **deployed portal** for dashboards (local server pages that query Prisma will not work without a DB)

If dev/prod deployments use Vercel Deployment Protection, set `VERCEL_AUTOMATION_BYPASS_SECRET` in `.env.remote.local`.

## Option B: Docker Postgres (fully offline)

When you need full local UI plus DB with no Neon at all:

```powershell
docker compose -f docker-compose.dev.yml up -d
copy .env.docker.example .env.docker.local
npm run dev:docker
# new terminal
$env:OFFICETRACKER_ENV_PROFILE="docker"; npm run db:push
$env:OFFICETRACKER_ENV_PROFILE="docker"; npm run seed:demo
```

Sign in with breakglass or demo user password. Dashboards run on localhost.

## Option C: Neon with relaxed SSL (when VPN allows)

When Neon is reachable (home, split tunnel, or corporate exception):

```powershell
npm run env:pull:dev
npm run db:push
npm run seed:demo
npm run dev
```

Prisma uses the pg adapter with relaxed TLS for PwC intercept (see commit `85e11e1`). If connection still fails, use Option A or B.

## Env profiles

| Profile | Command | Env files loaded |
|---|---|---|
| `dev` (default) | `npm run dev` | `.env`, `.env.local`, `.env.vercel.dev.local` |
| `prod` | `npm run dev:prod` | plus `.env.vercel.local`, `.env.vercel.prod.local` |
| `remote` | `npm run dev:remote` | plus `.env.remote.local` |
| `docker` | `npm run dev:docker` | plus `.env.docker.local` |

Set explicitly: `$env:OFFICETRACKER_ENV_PROFILE="remote"`

## Quick reference

| Goal | Path |
|---|---|
| Dashboards on VPN | Open deployed dev/prod URL |
| Mock agent events | `npm run dev:remote` then `/dev/simulator` |
| Seed test users | `npm run seed:demo:dev` when DB reachable |
| Full offline stack | Docker profile (Option B) |
| One real agent user | `%LOCALAPPDATA%\OfficeTracker\` (existing agent) |
| Regression agent harness | `OfficeTracker-Regression` + `agent-scenario.ps1` |

See also: `docs/local-demo-users.md`, `docs/local-env-files.md`, `docs/agent-regression-matrix.md`.
