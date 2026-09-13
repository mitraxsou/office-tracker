# Hobby plan scale tuning

Vercel Hobby includes **4 hours/month of Fluid Active CPU**. Office Pulse is tuned for ~200 pilot users on a single Hobby project.

## Agent defaults (v1.4.0+)

| Setting | Value | Effect |
|---|---|---|
| Activity tick interval | **10 min** (admin) | 6 sync POSTs/user/hour |
| Config poll interval | **60 task runs** (~2 h) | Fewer `GET /api/agent/config` calls |
| Local config cache | **2 h** | Skip config GET when `server-config.json` is fresh (resume still forces fetch) |
| Sync config push | Every sync response | `Apply-SyncConfig` updates local cache without a separate GET |

## API budget (per day)

Assumptions: task wakes every **2 min**, activity tick every **10 min**, 8 active hours/day per laptop.

| Route | 5 users | 200 users | Notes |
|---|---:|---:|---|
| `POST /api/agent/sync` | ~240 | ~9,600 | Dominates CPU (auth + event insert + optional maintenance) |
| `GET /api/agent/config` | ~60 (v1.3.9) → **~30** (v1.4.0) | ~2,400 → **~1,200** | Halved by 2 h poll + 2 h local cache |
| Dashboard SSR (`/dashboard`) | ~20-50 | ~400-1,000 | Throttled visit maintenance (15 min/user) |
| Crons (3 jobs) | 3 | 3 | Daily/weekly only (Hobby limit) |

Monthly sync volume at 200 users: **~288k POSTs** (manageable on Neon; CPU is the Hobby constraint).

## Server-side CPU reductions (v1.4.0)

1. **`GET /api/agent/config`**: `Cache-Control: private, max-age=7200` plus 60 s in-memory AppConfig cache.
2. **`POST /api/agent/sync`**: Visit maintenance only on `session_resume` / `daily_summary` batches (not `activity_tick`-only).
3. **Dashboard SSR**: `loadDaySpanContext` uses throttled maintenance (once per 15 min per user on reads).
4. **Crons**: Unchanged - already daily/weekly (Hobby-safe).

## Admin recommendations

1. Set **heartbeat interval to 10 minutes** in `/admin/settings` unless a user needs faster office detection.
2. Keep **agent mode = event** (default). Legacy heartbeat doubles DB writes.
3. After deploy, ask users to run **update.ps1** once so agents pick up v1.4.0 config caching.
4. Watch Vercel **Fluid Active CPU** after changes; target **< 3 h/month** at 200 users with 10 min ticks.
5. If CPU stays high, raise interval to **15 min** (4 syncs/hour) before upgrading Vercel plan.

## Projected reduction (5 users baseline)

| Source | Before (v1.3.9) | After (v1.4.0) | Reduction |
|---|---:|---:|---|
| Config GETs/day | ~60 | ~30 | **~50%** |
| Visit maintenance on dashboard load | Every page view | Max 1 / 15 min / user | **~90%+** on repeat views |
| Visit maintenance on activity_tick sync | None (already skipped) | None | - |
| Config route DB reads | Every GET | ~1/min global (cached) | **~95%** on hot path |

At **200 users** with 10 min ticks, projected Fluid Active CPU drops from an over-limit pilot (~4.5 h/month extrapolated from 5 users) to roughly **1.5-2.5 h/month**, within Hobby headroom.
