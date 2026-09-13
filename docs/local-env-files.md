# Local env files

Office Pulse loads env files from the repo root based on `OFFICETRACKER_ENV_PROFILE` (default: `dev`). Later files override earlier ones.

## Profiles

| Profile | Set with | Files loaded (in order) |
|---------|----------|-------------------------|
| **dev** (default) | `npm run dev` | `.env`, `.env.local`, `.env.vercel.dev.local` |
| **prod** | `npm run dev:prod` or `OFFICETRACKER_ENV_PROFILE=prod` | `.env`, `.env.local`, `.env.vercel.local`, `.env.vercel.prod.local` |

`npm run dev` uses the **dev** Neon database (`office-tracker-dev-db`). It does **not** load `.env.vercel.local` (Hobby prod Postgres).

## Files to keep

| File | Purpose |
|------|---------|
| `.env` | Shared defaults (committed via `.env.example`) |
| `.env.local` | Machine-specific overrides (OIDC token, local paths) |
| `.env.vercel.dev.local` | Hobby **dev** Vercel pull (`npm run env:pull:dev`) |
| `.env.vercel.local` | Hobby **prod** Postgres / Storage vars only (manual or Storage tab) |
| `.env.vercel.prod.local` | Hobby **prod** full env pull (`npm run env:pull:prod`) |

See `.env.local.example` and `.env.vercel.local.example` for templates.

## Optional (Enterprise pilot)

| File | Purpose |
|------|---------|
| `.env.vercel.enterprise.dev.local` | Enterprise dev extras (e.g. `AUTH_SECRET` for sync script) |
| `.env.vercel.enterprise.prod.local` | Enterprise prod extras |

Not used by `npm run dev` on the Hobby pilot. Safe to delete if you are not running `sync-enterprise-env.ps1`.

## Pull from Vercel (Hobby)

```powershell
npm run env:pull:dev    # office-tracker-dev -> .env.vercel.dev.local
npm run env:pull:prod   # office-tracker -> .env.vercel.prod.local
```

If `vercel env pull` fails on a PwC laptop, copy vars from the Vercel dashboard manually.

## Verify Postgres resolution

```powershell
$env:DEBUG_POSTGRES_ENV = "1"
node scripts/ensure-postgres-env.mjs
```

## Common mistakes

- **Prod data in local dev:** `.env.vercel.local` was loaded for every `npm run dev` before profile support. Use the default dev profile or remove prod Postgres from files loaded in dev.
- **Missing dev Neon:** Run `npm run env:pull:dev` or paste `POSTGRES_*` into `.env.vercel.dev.local`.
- **Bad VERCEL_TOKEN:** Clear it before pull: `Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue`
