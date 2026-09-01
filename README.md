# PwC Office Pulse (Office Tracker)

Pilot app to track **5 hours/day in the PwC office** on PwC laptops. Auto-detection uses office Wi-Fi SSIDs only:

- **OfficeConnect**
- **ExternalConnect**

GlobalProtect/VPN is logged for diagnostics only and **never** counts toward office hours.

The Windows agent is branded **PwC Office Pulse**.

**Production:** https://github.com/mitraxsou/office-tracker → deploy on Vercel with Neon Postgres.

---

## Breakglass admin (production)

Set both env vars on Vercel (and locally):

| Variable | Example |
|---|---|
| `BREAKGLASS_EMAIL` | `admin@pwc.office` |
| `BREAKGLASS_PASSWORD` | Strong password (change from default) |

The account is created on app startup and seed. Sign in at `/login`, then `/admin`.

Also set `ALLOW_REGISTRATION=false` on production to block public sign-ups.

---

## Data persistence

| Environment | Database |
|---|---|
| **Local dev** | Neon Postgres (recommended) or local Postgres via `DATABASE_URL` or `POSTGRES_PRISMA_URL` |
| **Production (Vercel)** | Vercel Storage → Postgres (Neon). Auto-injects `POSTGRES_*` env vars when linked to the project |

User identity is **email + userId** in the database. Visit history lives in Postgres, not on the laptop.

---

## Deploy to Vercel (one-time)

### 1. Vercel Storage (Postgres / Neon)

1. In your Vercel project: **Storage** → **Create Database** → **Postgres**
2. Connect the database to the **office-tracker** project (Vercel auto-injects env vars)

**Auto-injected by Vercel Storage** (do not create manually):

| Variable | Purpose |
|---|---|
| `POSTGRES_URL` | General connection |
| `POSTGRES_PRISMA_URL` | Prisma Client (pooled; used by the app) |
| `POSTGRES_URL_NON_POOLING` | Migrations / `prisma db push` |

Prisma is configured to use `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`. The app auto-maps legacy `DATABASE_URL` and misconfigured `DATABASE_URL_*` prefixed Storage vars (see below).

### Fix misconfigured Storage prefix (`DATABASE_URL_`)

If Vercel shows vars like `DATABASE_URL_POSTGRES_URL`, `DATABASE_URL_DATABASE_URL`, `DATABASE_URL_UNPOOLED` instead of `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, the Storage connection was linked with a **custom prefix**. The app will still deploy using those prefixed vars, but you should fix the dashboard:

1. Vercel project → **Settings** → **Environment Variables**
2. **Delete** every var starting with `DATABASE_URL_` that came from Storage (e.g. `DATABASE_URL_POSTGRES_URL`, `DATABASE_URL_DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DATABASE_URL_POSTGRES_HOST`, …)

   **Bulk delete (no CLI login):** use [scripts/vercel-env-setup.md](scripts/vercel-env-setup.md) and `scripts/cleanup-vercel-env.ps1` with a [Vercel API token](https://vercel.com/account/tokens) — works on PwC laptops where `vercel login` fails SSL inspection.
3. **Storage** tab → select your Postgres database → **Connect to Project**
4. When prompted for env var prefix, leave it **blank** (default) — do **not** enter `DATABASE_URL`
5. Confirm these appear (no prefix): `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`
6. **Redeploy** (Deployments → … → Redeploy)

**Quick workaround (no reconnect):** copy the value of `DATABASE_URL_POSTGRES_URL` (or `DATABASE_URL_DATABASE_URL`) and create a manual env var `DATABASE_URL` with that value for Production, Preview, and Development. Redeploy.

### 2. Import GitHub repo in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **mitraxsou/office-tracker**
3. Framework: **Next.js** (auto-detected)
4. Link Vercel Storage Postgres (step 1)
5. Add **manual** environment variables:

| Variable | Value |
|---|---|
| `AUTH_SECRET` | Random 32+ char string |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` (update after first deploy) |
| `BREAKGLASS_EMAIL` | `admin@pwc.office` |
| `BREAKGLASS_PASSWORD` | Your secure password |
| `ALLOW_REGISTRATION` | `false` |
| `DEFAULT_OFFICE_SSIDS` | `OfficeConnect,ExternalConnect` |
| `INTEGRATION_API_KEY` | (optional) Secures `/api/integrations/alerts` for Power Automate — see [docs/power-automate.md](docs/power-automate.md) |

6. Deploy

### 3. Initialize database

**When PwC firewall blocks Neon (port 5432 / Prisma P1001) — run setup on Vercel deploy:**

1. Vercel project → **Settings** → **Environment Variables**
2. Add **`RUN_DB_SETUP_ON_DEPLOY`** = **`true`** for **Production** only
3. Confirm **`BREAKGLASS_EMAIL`** and **`BREAKGLASS_PASSWORD`** are already set (seed creates the admin user)
4. **Deployments** → latest deployment → **⋯** → **Redeploy** (or push a commit to `main`)
5. Watch build logs for `RUN_DB_SETUP_ON_DEPLOY=true — running prisma db push and seed`
6. After a successful deploy, sign in at your production URL with breakglass credentials → `/admin`
7. During **pilot testing**, it is safe to leave `RUN_DB_SETUP_ON_DEPLOY=true` for multiple deploys. Each build runs `prisma db push` (applies schema changes) and `seed` (ensures breakglass admin + default AppConfig). This does **not** wipe users, visits, heartbeats, or audit data unless a schema change is breaking (rare during pilot). Seed resets AppConfig defaults (hours target, SSIDs, registration toggle) on every run.
8. When the pilot is stable, **remove** `RUN_DB_SETUP_ON_DEPLOY` or set it to **`false`** so normal deploys skip push/seed. Minor schema fixes (e.g. new columns) also run automatically at server startup via `src/instrumentation.ts`.

This runs during `npm run build` on Vercel (which can reach Neon). Local `npm run db:push` / `db:seed` are unchanged for machines that can connect.

**Alternative — manual env copy on a machine that can reach Neon:**

**Recommended (manual env copy — works when `vercel env pull` fails on PwC laptops):**

1. In Vercel: **Storage** → your Postgres database → **`.env.local` tab**  
   Copy `POSTGRES_PRISMA_URL` and `POSTGRES_URL_NON_POOLING`.  
   *(Alternative: **Settings** → **Environment Variables** → copy all three `POSTGRES_*` values for Production.)*
2. In the project root:

```powershell
Copy-Item .env.vercel.local.example .env.vercel.local
# Edit .env.vercel.local — paste the two POSTGRES_* URLs (keep quotes)
notepad .env.vercel.local
```

3. Push schema and seed:

```powershell
Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue   # if vercel pull failed earlier
.\scripts\setup-prod-db.ps1
```

Or run the steps manually:

```powershell
npm run db:push
npm run db:seed
```

**Optional — Vercel CLI pull** (only if `vercel login` / token works):

```powershell
Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue
npx vercel env pull .env.vercel.local
.\scripts\setup-prod-db.ps1
```

If pull fails with `You defined "--token", but its contents are invalid`, a bad `VERCEL_TOKEN` is still set in PowerShell from an earlier attempt. Clear it with `Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue` and retry, or skip pull and use manual copy above.

For local Neon dev, set `DATABASE_URL` or `POSTGRES_PRISMA_URL` in `.env.local` — `scripts/ensure-postgres-env.mjs` loads `.env`, `.env.local`, and `.env.vercel.local`, maps legacy names, and passes resolved vars to Prisma.

**Do not run raw `npx prisma db push`.** Prisma only reads `.env`, not `.env.vercel.local`. Use `npm run db:push`, `.\scripts\setup-prod-db.ps1`, or `node scripts/prisma-with-env.mjs db push`.

### 4. Set production URL

After first deploy, set `NEXT_PUBLIC_APP_URL` to your Vercel URL and **redeploy**.

Agent install commands in Settings will then use the Vercel URL automatically.

---

## Quick start (colleagues)

1. Sign in at the **Vercel URL** → **Settings**
2. **Download agent (.zip)** → extract to `%USERPROFILE%\Downloads\PwCOfficePulse`
3. **Copy install command** → run in PowerShell
4. Verify: `powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OfficeTracker\office-heartbeat.ps1" -DryRun`

---

## Local development

```bash
npm install
cp .env.example .env.local
# Edit .env.local: DATABASE_URL or POSTGRES_PRISMA_URL (Neon), AUTH_SECRET, NEXT_PUBLIC_APP_URL=http://localhost:3000
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

---

## Admin dashboard

- **URL:** `/admin` (admin role required)
- Summary cards, 7-day charts, user table, activity log
- Global settings: `/admin/settings`

---

## Agent on your laptop

| Item | Location |
|---|---|
| Install folder | `%LOCALAPPDATA%\OfficeTracker\` |
| Scheduled task | `PwCOfficePulse` (hidden via VBS wrapper) |
| Startup shortcut | `PwC Office Pulse.lnk` |

---

## Policy

Opt-in pilot only. Collects SSID + timestamps only. No browsing history, process lists, or screenshots.
