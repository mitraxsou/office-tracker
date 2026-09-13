# Local demo users

Demo accounts for dashboard testing and the agent event simulator. All use the shared password below. Agent tokens are written to `.demo-users.local.json` (gitignored) when you run the seed script.

**Shared password:** `Demo-Users-2026!`

| Email | Role | Dashboard pattern |
|---|---|---|
| `demo.admin@office-tracker.test` | admin | Admin reports plus compliant-style history |
| `demo.compliant@office-tracker.test` | user | Meets 5+ office hours on most weekdays |
| `demo.partial@office-tracker.test` | user | Partial hours (2-4h) |
| `demo.behind@office-tracker.test` | user | Behind the 5h target |
| `demo.traveler@office-tracker.test` | user | Mix of OfficeConnect and ExternalConnect |

## Seed users (when Postgres is reachable)

| Target DB | Command |
|---|---|
| Local dev Neon | `npm run seed:demo` |
| Dev portal DB | `npm run seed:demo:dev` (needs `npm run env:pull:dev`) |
| Prod (theta) Neon | `$env:CONFIRM_PROD="yes"; npm run seed:demo:prod` |
| Docker Postgres | `docker compose -f docker-compose.dev.yml up -d` then `OFFICETRACKER_ENV_PROFILE=docker npm run db:push` and `OFFICETRACKER_ENV_PROFILE=docker npm run seed:demo` |

After seeding, open `.demo-users.local.json` for agent tokens (simulator only; do not commit).

## Sign in

- **OTP:** Works when Power Automate and DB are configured on the target portal.
- **Password:** Use `Demo-Users-2026!` on portals where password login is enabled.
- **Breakglass:** Local/docker only, via `BREAKGLASS_EMAIL` / `BREAKGLASS_PASSWORD` in `.env.local`.

## Agent simulator (no extra Windows agent installs)

1. Seed demo users (above) or copy `.demo-users.local.json` from a teammate.
2. Start dev server:
   - Local DB: `npm run dev`
   - VPN blocks Neon: `npm run dev:remote` (see `docs/local-dev-connectivity.md`)
3. Open **http://localhost:3000/dev/simulator**
4. Pick a demo user and trigger events (office arrival, activity tick, visit end, and so on).
5. View dashboards on the portal that backs the target DB (localhost or deployed dev/prod).

## Regression dummy user (separate)

| Email | Password | Purpose |
|---|---|---|
| `regression.dummy@office-tracker.test` | `Regression-Only-2026!` | Agent regression harness only (`scripts/regression/create-regression-user.ts`) |

See `docs/agent-regression-matrix.md` for laptop agent scenarios with `OfficeTracker-Regression` install dir.

## Multi-user agent simulation options

| Approach | When to use |
|---|---|
| **Dev simulator** (`/dev/simulator`) | Default. One local control panel posts sync events for any seeded demo user. |
| **Regression install dir** | `%LOCALAPPDATA%\OfficeTracker-Regression\` via `agent-scenario.ps1` for one user. |
| **Separate install dirs** | Set `OFFICETRACKER_INSTALL_DIR` per user if you need full agent script behavior for multiple users. |

Office SSIDs used in the simulator: `OfficeConnect`, `ExternalConnect`, `pwcglb.com`, and `HomeWiFi` (not in allowlist).
