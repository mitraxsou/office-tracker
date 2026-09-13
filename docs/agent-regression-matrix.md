# Agent and portal regression matrix

PwC Office Pulse regression scenarios for the Windows agent (`agent/`) and portal (`src/`). Use the dummy regression user only; never wipe production installs or non-regression accounts.

**Regression install dir:** `%LOCALAPPDATA%\OfficeTracker-Regression\` (set `OFFICETRACKER_INSTALL_DIR` before running scenarios).

**Dummy user:** `regression.dummy@office-tracker.test` (created by `scripts/regression/create-regression-user.ts`).

**Not auto-deployed:** Running regression setup locally only writes to the database behind your current `POSTGRES_PRISMA_URL` (usually dev Neon from `.env.local`). The dummy user is **not** created on https://office-tracker-theta.vercel.app unless you run the create script against **production** Neon or create the user manually in prod admin.

| Target | How to create regression user |
|---|---|
| Local / dev | `npm run prisma:env -- tsx scripts/regression/create-regression-user.ts` |
| Prod (theta) | Set `POSTGRES_PRISMA_URL` to prod Neon (Vercel `office-tracker` production), then `$env:CONFIRM_PROD="yes"; npm run regression:create-prod` |
| Prod (theta) alt | Create `regression.dummy@office-tracker.test` via `/admin` on theta and issue an agent token |

| ID | Scenario | Agent steps / trigger | Expected agent behavior | Expected portal state | How to verify |
|---|---|---|---|---|---|
| H1 | Fresh install | Run bootstrap setup command from Settings | Downloads `agent-download.ps1` + `agent-storage.ps1` before `setup.ps1` IEX; writes `config.json`, `version.txt` | User shows registered device after first sync | `npm run test:regression` bootstrap test; laptop: check regression install dir |
| H2 | Home Wi-Fi idle | `agent-scenario.ps1 -Scenario home_wifi` | Queues `activity_tick` + optional `health_ping`; syncs without `visit_start` | No open visit; dashboard shows recent last synced | Agent `-DryRun` queue has no `visit_start`; portal dashboard no open visit |
| H3 | Office arrival | `-Scenario office_arrival` | `wifi_connected` / `ssid_changed`, `visit_start`, open visit in sync state | Open visit; in-office now | Dry-run open visit JSON; `/dashboard` shows checked in |
| H4 | Office day | Repeated ticks on office SSID | `activity_tick` every heartbeat interval; visit stays open | Office hours accumulate | History day view office ms increases |
| H5 | Office departure | `-Scenario office_departure` | `visit_end` at disconnect timestamp; `wifi_disconnected` or `ssid_changed` | Visit closed at disconnect time | `visit.endAt` matches queued `visit_end.at` |
| H6 | Sleep / wake at home | `-Scenario sleep_wake` | `session_resume` + forced `activity_tick`; sync on resume | Maintenance may close stale visits; no false open visit | Dry-run shows `session_resume`; server `presenceTransition` row |
| H7 | Overnight queue | Depart office, laptop off until morning | `visit_end` preserved with disconnect timestamp; events stay in queue | Visit closed at yesterday disconnect when sync runs | Queue file still has events before sync; after sync visit `endAt` correct |
| H8 | New calendar day on office Wi-Fi | `-Scenario day_rollover` | `daily_summary` for prior day; new `visit_start` if still on office SSID | Prior day summary; new visit for today | Dry-run queue: `daily_summary` then `visit_start` |
| H9 | Auto-update v1.3.x | Server version newer than local | Self-update via `setup.ps1` IEX; no admin scheduled task; EXIT only when version changes | Device `agentScriptVersion` updates | `tests/agent-version.test.ts`; log `Auto-update finished` |
| H10 | Portal dashboard healthy | Agent syncing on interval at home | `resolveAgentSyncHealth` healthy; no stale warning | Last synced recent; no agent stale banner | `tests/activity-signal.test.ts` |
| C1 | PS 5.1 dot-source scope | Dot-source `agent-storage.ps1` at script scope | `Invoke-AgentStorageMaintenance` visible; no `Import-AgentStorageModule` helper | N/A (install/bootstrap) | `tests/agent-ps51-compat.test.ts` |
| C2 | PS 5.1 pipeline pollution | Heartbeat queue mutations | Uses `@($Queue \| Where-Object ...)` not bare pipeline assignment | N/A | `tests/agent-ps51-compat.test.ts` |
| C3 | PS 5.1 inline if | Storage / heartbeat conditionals | `if ($x) { $y } else { $z }` blocks, not `if ($x) $y else $z` on multi-statement branches | N/A | `tests/agent-ps51-compat.test.ts` |
| C4 | Wake sync ordering | Batch: `visit_end` + `session_resume` + `daily_summary` | Agent queues disconnect before resume | Server processes `visit_end` before maintenance | `tests/agent-sync.test.ts` ordering tests |
| C5 | EOD close vs agent visit_end | Open visit past midnight; agent sends `visit_end` at disconnect | Server applies agent `visit_end` first; maintenance runs after | Visit `endAt` = disconnect, not midnight default | `tests/heartbeat-eod.test.ts` |
| C6 | EOD close without agent end | Open visit; no disconnect event | `closeEndOfDayOpenVisits` uses office disconnect transition or last tick | Visit closed at day end cap | `tests/heartbeat-eod.test.ts` |
| C7 | forceAgentUpdate loop | Admin forces update; local already current | `Test-NeedsAgentUpdateFromResponse` false when local >= server; sync not blocked | `forceAgentUpdate` clears after version report | `tests/agent-heartbeat-sync.test.ts`; `tests/agent-sync.test.ts` |
| C8 | Log cap 10 MB | Large log files in regression dir | `Invoke-AgentLogMaintenance` truncates; total under cap | N/A | `tests/agent-storage.test.ts` |
| C9 | Queue bounds | >400 expendable events | Critical `visit_*` / `daily_summary` kept; stale expendable pruned | N/A | `tests/agent-storage.test.ts` |
| C10 | Last synced vs last office activity | Home sync after office day | Dashboard: last synced recent; last office activity shows office tick time | Two distinct timestamps on dashboard | Portal manual check; `resolveAgentSyncHealth` tests |
| C11 | Duplicate event id | Re-send same `clientEventId` | Server acks without double-applying | Single visit row | API test / manual re-sync |
| C12 | SSID not in allowlist | `visit_start` on home SSID | Server rejects `ssid_not_allowed` | No visit created | `tests/agent-sync.test.ts` (extend) |
| C13 | API hit counting | POST `/api/agent/sync` (and legacy heartbeat, config) | Each successful agent API call increments daily counter | Admin user report shows day/month/year API hit totals | `tests/agent-api-hits.test.ts` |

## Automated coverage map

| Area | Tests |
|---|---|
| Agent script invariants | `tests/agent-heartbeat-sync.test.ts`, `tests/agent-storage.test.ts`, `tests/agent-version.test.ts`, `tests/agent-ps51-compat.test.ts` |
| Server sync / ordering | `tests/agent-sync.test.ts`, `tests/heartbeat-eod.test.ts` |
| Agent API hit totals | `tests/agent-api-hits.test.ts` |
| Dashboard health | `tests/activity-signal.test.ts` |

## Laptop regression (manual + harness)

See `docs/local-demo-users.md` for demo users and the dev simulator at `/dev/simulator`.

```powershell
# 1. Create or refresh dummy user (requires .env.local with Postgres)
npm run prisma:env -- tsx scripts/regression/create-regression-user.ts

# 2. Reset local regression install + optional DB rows for dummy user
.\scripts\regression\reset-regression-state.ps1 -All

# 3. Run one scenario (dry-run inspects queue without posting)
.\scripts\regression\agent-scenario.ps1 -Scenario office_arrival -DryRun

# 4. Full orchestrated pass (automated tests + scenario dry-runs)
.\scripts\regression\run-regression.ps1
```

### Environment

| Variable | Purpose |
|---|---|
| `POSTGRES_PRISMA_URL` | Required for `create-regression-user.ts` and DB reset |
| `OFFICETRACKER_INSTALL_DIR` | Override install path (default regression dir in harness) |
| `REGRESSION_API_URL` | Portal base URL for live API checks (default `http://localhost:3000`; prod script sets theta) |
| `NEXT_PUBLIC_APP_URL` | Used when seeding regression `config.json` |
| `CONFIRM_PROD` | Must be `yes` for `npm run regression:create-prod` (writes to `POSTGRES_PRISMA_URL`) |

## Out of scope

- Production user `soumitro` / real `OfficeTracker` install under `%LOCALAPPDATA%\OfficeTracker\`
- GlobalProtect / VPN as office signal (diagnostic only)
- Multi-laptop device limits beyond one regression serial
