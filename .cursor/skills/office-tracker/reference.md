# Office Tracker reference

## Environment variables

| Variable | Purpose |
|---|---|
| `POSTGRES_PRISMA_URL` | Prisma Client (pooled). Auto from Vercel Storage; or set locally |
| `POSTGRES_URL_NON_POOLING` | Migrations / `db push`. Auto from Vercel Storage; or set locally |
| `DATABASE_URL` | Legacy local alias — resolved to `POSTGRES_*` at runtime |
| `DATABASE_URL_*` | Misconfigured Storage prefix vars — auto-mapped; reconnect Storage with no prefix |
| `AUTH_SECRET` | Session JWT (32+ chars) |
| `NEXT_PUBLIC_APP_URL` | Public URL for install commands and agent |
| `DEFAULT_OFFICE_SSIDS` | Seed value; admin manages via AppConfig in prod |
| `ADMIN_EMAIL` | Promote user to admin on seed |
| `BREAKGLASS_EMAIL` | Recovery admin email (with password) |
| `BREAKGLASS_PASSWORD` | Recovery admin password |
| `ALLOW_REGISTRATION` | `"false"` disables `/register` in production |
| `AGENT_INSTALL_PATH` | Optional full path to `agent/` for local dev install copy |

## API routes

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/heartbeat` | Agent token + serial | Record presence |
| `GET /api/agent/config` | Bearer token | SSIDs, hours target, timezone |
| `GET /api/agent/download` | Session | Agent zip download |
| `POST /api/settings/install-command` | Session | One-step install command |
| `POST /api/settings/regenerate-token` | Session | New agent token |
| `GET /api/today` | Session | Today's summary |
| `POST /api/visits` | Session | Manual visit |
| `POST /api/visits/check-in` | Session | Quick check-in |
| `POST /api/visits/check-out` | Session | Quick check-out |
| `GET /api/admin/users` | Admin | All users status |
| `GET /api/admin/reports` | Admin | Chart data |
| `PATCH /api/admin/config` | Admin | Global SSIDs / hours |
| `POST/PATCH/DELETE /api/admin/visits` | Admin | Correct visits |
| `DELETE /api/admin/devices/[id]` | Admin | Unbind laptop |

## Prisma models (high level)

- `User` — email, role, timezone, optional hoursTarget override
- `AgentToken` — bcrypt token hash, tokenPrefix lookup
- `AgentDevice` — serialNumber, lastSeenAt per user
- `AppConfig` — global hoursTarget, monthlyDaysTarget, officeSsids JSON
- `Heartbeat` — ssid, inOffice, vpnGateway, recordedAt
- `Visit` — startAt, endAt, source (wifi|manual)
- `AuditLog` — admin actions

## Agent local paths (show users in Settings)

- Install dir: `%LOCALAPPDATA%\OfficeTracker\`
- Task: `PwCOfficePulse`
- Startup: `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\PwC Office Pulse.lnk`
- Logs: `%LOCALAPPDATA%\OfficeTracker\logs\heartbeat.log`

## Pilot policy

Opt-in only. Colleagues on PwC laptops. Collect SSID + timestamps + serial only. Not HR/badge integration.
