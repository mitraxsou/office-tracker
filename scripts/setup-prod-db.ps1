#Requires -Version 5.1
<#
.SYNOPSIS
  Push Prisma schema and seed the production (Neon) database from your laptop.

.DESCRIPTION
  1. Clears a bad VERCEL_TOKEN (invalid tokens break `vercel env pull`).
  2. Checks .env.vercel.local for Postgres connection strings.
  3. Runs npm run db:push and npm run db:seed with resolved env.

  Manual env copy (no Vercel CLI):
    Vercel → Storage → Postgres → .env.local tab
    Copy POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING into .env.vercel.local
    (see .env.vercel.local.example)

.PARAMETER TryEnvPull
  After clearing VERCEL_TOKEN, run `npx vercel env pull .env.vercel.local`.
  Skipped by default — use when CLI login/token works.

.EXAMPLE
  .\scripts\setup-prod-db.ps1

.EXAMPLE
  .\scripts\setup-prod-db.ps1 -TryEnvPull
#>
[CmdletBinding()]
param(
    [switch]$TryEnvPull
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Info([string]$Message) {
    Write-Host $Message -ForegroundColor Cyan
}

function Write-Success([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}

function Write-Warn([string]$Message) {
    Write-Host $Message -ForegroundColor Yellow
}

function Write-Err([string]$Message) {
    Write-Host $Message -ForegroundColor Red
}

function Get-DotEnvValue {
    param(
        [string]$FilePath,
        [string]$Key
    )

    if (-not (Test-Path -LiteralPath $FilePath)) {
        return $null
    }

    foreach ($line in Get-Content -LiteralPath $FilePath) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -match '^(?<key>[A-Za-z_][A-Za-z0-9_]*)=(?<value>.*)$') {
            if ($Matches.key -ne $Key) { continue }
            $value = $Matches.value.Trim()
            if (
                ($value.StartsWith('"') -and $value.EndsWith('"')) -or
                ($value.StartsWith("'") -and $value.EndsWith("'"))
            ) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            if ($value) { return $value }
        }
    }

    return $null
}

function Test-PostgresEnvFile {
    param([string]$FilePath)

    $keys = @(
        "POSTGRES_PRISMA_URL",
        "POSTGRES_URL_NON_POOLING",
        "POSTGRES_URL",
        "DATABASE_URL"
    )

    $found = @()
    foreach ($key in $keys) {
        $value = Get-DotEnvValue -FilePath $FilePath -Key $key
        if ($value -and $value -match '^postgres(ql)?://') {
            $found += $key
        }
    }

    return $found
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

Write-Info "PwC Office Pulse — production DB setup"
Write-Host ""

if ($env:VERCEL_TOKEN) {
    Write-Warn "Clearing VERCEL_TOKEN from this PowerShell session (invalid tokens break vercel env pull)."
    Remove-Item Env:VERCEL_TOKEN -ErrorAction SilentlyContinue
}

$envFile = Join-Path $repoRoot ".env.vercel.local"
$exampleFile = Join-Path $repoRoot ".env.vercel.local.example"

if ($TryEnvPull) {
    Write-Info "Pulling env from Vercel into .env.vercel.local ..."
    npx vercel env pull .env.vercel.local
    if ($LASTEXITCODE -ne 0) {
        Write-Err "vercel env pull failed. Use manual copy from the Vercel dashboard instead."
        Write-Host ""
        Write-Host "  1. Vercel → Storage → Postgres → .env.local tab"
        Write-Host "  2. Copy POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING"
        Write-Host "  3. Paste into .env.vercel.local (see .env.vercel.local.example)"
        exit 1
    }
}

if (-not (Test-Path -LiteralPath $envFile)) {
    Write-Err "Missing .env.vercel.local"
    Write-Host ""
    Write-Host "Create it from the Vercel dashboard:"
    Write-Host "  1. Vercel → Storage → Postgres → .env.local tab"
    Write-Host "     OR Settings → Environment Variables → copy POSTGRES_* for Production"
    Write-Host "  2. Copy template: Copy-Item .env.vercel.local.example .env.vercel.local"
    Write-Host "  3. Paste real POSTGRES_PRISMA_URL and POSTGRES_URL_NON_POOLING values"
    Write-Host ""
    Write-Host "Then re-run: .\scripts\setup-prod-db.ps1"
    exit 1
}

$foundKeys = Test-PostgresEnvFile -FilePath $envFile
if ($foundKeys.Count -eq 0) {
    Write-Err ".env.vercel.local exists but has no Postgres URL."
    Write-Host ""
    Write-Host "Add at least one of: POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING, POSTGRES_URL, DATABASE_URL"
    Write-Host "Example template: $exampleFile"
    exit 1
}

Write-Success "Found Postgres env in .env.vercel.local: $($foundKeys -join ', ')"
Write-Host ""

Write-Info "Pushing schema (npm run db:push) ..."
npm run db:push
if ($LASTEXITCODE -ne 0) {
    Write-Err "db:push failed. Check connection strings and Neon/Vercel Storage link."
    exit 1
}

Write-Info "Seeding database (npm run db:seed) ..."
npm run db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Err "db:seed failed."
    exit 1
}

Write-Host ""
Write-Success "Production database schema pushed and seeded."
Write-Host "Sign in at your Vercel URL with BREAKGLASS_EMAIL / BREAKGLASS_PASSWORD, then open /admin."
