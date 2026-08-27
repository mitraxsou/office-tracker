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
| **Local dev** | Neon Postgres (recommended) or local Postgres via `DATABASE_URL` |
| **Production (Vercel)** | Neon Postgres via `DATABASE_URL` |

User identity is **email + userId** in the database. Visit history lives in Postgres, not on the laptop.

---

## Deploy to Vercel (one-time)

### 1. Neon Postgres

1. Create a free project at [neon.tech](https://neon.tech)
2. Copy the **PostgreSQL connection string** (with `?sslmode=require`)

### 2. Import GitHub repo in Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import **mitraxsou/office-tracker**
3. Framework: **Next.js** (auto-detected)
4. Add environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `AUTH_SECRET` | Random 32+ char string |
| `NEXT_PUBLIC_APP_URL` | `https://YOUR-PROJECT.vercel.app` (update after first deploy) |
| `BREAKGLASS_EMAIL` | `admin@pwc.office` |
| `BREAKGLASS_PASSWORD` | Your secure password |
| `ALLOW_REGISTRATION` | `false` |
| `DEFAULT_OFFICE_SSIDS` | `OfficeConnect,ExternalConnect` |

5. Deploy

### 3. Initialize database

From your machine (with Neon `DATABASE_URL` in env):

```bash
npx prisma db push
npm run db:seed
```

Or set `DATABASE_URL` in Vercel, pull env, and run locally:

```bash
npx vercel env pull .env.vercel.local
# set DATABASE_URL from pulled file, then:
npx prisma db push
npm run db:seed
```

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
# Edit .env.local: DATABASE_URL (Neon), AUTH_SECRET, NEXT_PUBLIC_APP_URL=http://localhost:3000
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
