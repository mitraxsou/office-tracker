# PwC Office Pulse (Office Tracker)

Pilot app to track **5 hours/day in the PwC office** on PwC laptops. Auto-detection uses office Wi-Fi SSIDs only:

- **OfficeConnect**
- **ExternalConnect**

GlobalProtect/VPN is logged for diagnostics only and **never** counts toward office hours.

The Windows agent is branded **PwC Office Pulse**.

---

## Breakglass admin (change before production)

A hardcoded admin account is always created on startup/seed:

| Field | Value |
|---|---|
| Email | `admin@pwc.office` |
| Password | `OfficeTracker!2026` |

**Change this password before any production deploy.** Sign in at `/login`, then open `/admin` for reporting and user management.

Additional admins: set `ADMIN_EMAIL` in env to promote an existing user on seed.

---

## Data persistence

| Environment | Database | Notes |
|---|---|---|
| **Local dev** | SQLite file `prisma/dev.db` | Survives dev server restarts |
| **Production (Vercel)** | Neon Postgres via `DATABASE_URL` | All user data, visits, tokens |

User identity is **email + userId** in the database. Agent tokens are stored server-side (bcrypt). Visit history is never stored only on the laptop — a new laptop auto-registers via heartbeat with the same user account.

---

## Quick start (colleagues)

### 1. Web app

Sign in at your deployed Vercel URL → **Settings**.

### 2. Install PwC Office Pulse (no admin, no GitHub)

1. Click **Download agent (.zip)** on Settings
2. Extract to `%USERPROFILE%\Downloads\PwCOfficePulse`
3. Click **Copy install command** (token + API URL baked in)
4. Paste and run in **PowerShell** (not cmd.exe)

On Vercel, the install command uses `NEXT_PUBLIC_APP_URL` automatically.

### 3. Verify

```powershell
powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OfficeTracker\office-heartbeat.ps1" -DryRun
```

### 4. Uninstall

Use **Copy uninstall command** on Settings, or:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\PwCOfficePulse\uninstall.ps1"
```

Removes scheduled task `PwCOfficePulse`, Startup shortcut, and `%LOCALAPPDATA%\OfficeTracker\`.

---

## Admin dashboard

- **URL:** `/admin` (admin role required)
- Summary cards: users, in office now, compliance %, avg hours
- Charts: 7-day hours trend, compliance rate, user status breakdown
- User table with devices and last heartbeat
- Admin activity log (visit corrections, device removals)
- Global settings: `/admin/settings`

---

## Agent on your laptop

| Item | Location |
|---|---|
| Install folder | `%LOCALAPPDATA%\OfficeTracker\` |
| Scheduled task | `PwCOfficePulse` (runs hidden via VBS wrapper) |
| Startup shortcut | `%APPDATA%\...\Startup\PwC Office Pulse.lnk` |

The agent runs **hidden** — scheduled task uses `wscript.exe` + `run-heartbeat.vbs` (no PowerShell window flash).

---

## Local development

```bash
npm install
cp .env.example .env.local
npx prisma db push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Breakglass admin: `admin@pwc.office` / `OfficeTracker!2026`.

Optional local dev install path: set `AGENT_INSTALL_PATH` to your project's `agent` folder.

### Tests

```bash
npm test
npm run build
```

---

## Environment variables

| Variable | Example |
|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` (local) or Neon Postgres URL |
| `AUTH_SECRET` | Random 32+ char string |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |
| `DEFAULT_OFFICE_SSIDS` | `OfficeConnect,ExternalConnect` |
| `ADMIN_EMAIL` | Optional extra admin promotion on seed |
| `AGENT_INSTALL_PATH` | Optional full path to `agent` folder for local dev |

---

## Policy

Opt-in pilot only. Collects SSID + timestamps only. No browsing history, process lists, or screenshots.
