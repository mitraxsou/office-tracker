#Requires -Version 5.1
<#
.SYNOPSIS
  Copy env vars from local .env files to a PwC Enterprise Vercel project via API.

.DESCRIPTION
  Uses curl.exe (PwC-friendly). Does not print secret values.
  Supports dev and prod profiles so Enterprise projects stay separate from Hobby.

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\sync-enterprise-env.ps1 -Profile dev
  .\scripts\sync-enterprise-env.ps1 -Profile prod
#>
[CmdletBinding()]
param(
    [ValidateSet("dev", "prod")]
    [string]$Profile = "dev",
    [string]$ProjectName,
    [string]$TeamId = "team_aibOHBi06MpPxWdFWRGDp9iK",
    [string[]]$EnvFiles,
    [string]$ExtraEnvFile = ".env",
    [string]$AppUrl,
    [string]$ProductionBranch,
    [string]$RunDbSetupOnDeploy
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not $env:VERCEL_TOKEN) {
    throw "VERCEL_TOKEN required (https://vercel.com/account/tokens)"
}

$profiles = @{
    dev = @{
        ProjectName        = "office-tracker-dev-9824"
        EnvFiles           = @(".env.vercel.dev.local")
        ExtraEnvFile       = ".env"
        AppUrl             = "https://office-tracker-dev-9824.vercel.app"
        ProductionBranch   = "dev"
        RunDbSetupOnDeploy = "false"
    }
    prod = @{
        ProjectName        = "office-tracker-prod"
        EnvFiles           = @(".env.vercel.local", ".env.vercel.prod.local")
        ExtraEnvFile       = ""
        AppUrl             = "https://office-tracker-prod.vercel.app"
        ProductionBranch   = "production"
        RunDbSetupOnDeploy = "false"
    }
}

$selected = $profiles[$Profile]
if (-not $ProjectName) { $ProjectName = $selected.ProjectName }
if (-not $EnvFiles) { $EnvFiles = $selected.EnvFiles }
if (-not $PSBoundParameters.ContainsKey("ExtraEnvFile")) { $ExtraEnvFile = $selected.ExtraEnvFile }
if (-not $AppUrl) { $AppUrl = $selected.AppUrl }
if (-not $ProductionBranch) { $ProductionBranch = $selected.ProductionBranch }
if (-not $RunDbSetupOnDeploy) { $RunDbSetupOnDeploy = $selected.RunDbSetupOnDeploy }

$repoRoot = Split-Path -Parent $PSScriptRoot

function Read-DotEnvFile {
    param([string]$Path)
    $result = @{}
    if (-not (Test-Path -LiteralPath $Path)) { return $result }
    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $eq = $line.IndexOf("=")
        if ($eq -lt 1) { return }
        $key = $line.Substring(0, $eq).Trim()
        $value = $line.Substring($eq + 1).Trim()
        if ($value.StartsWith('"') -and $value.EndsWith('"')) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        if ($value) { $result[$key] = $value }
    }
    return $result
}

function Invoke-VercelJson {
    param(
        [ValidateSet("GET", "POST", "PATCH", "DELETE")]
        [string]$Method,
        [string]$Url,
        [string]$Body
    )
    $curlArgs = @(
        "--ssl-no-revoke", "--silent", "--show-error", "--fail-with-body",
        "--request", $Method,
        "--header", "Authorization: Bearer $env:VERCEL_TOKEN",
        "--header", "Content-Type: application/json"
    )
    if ($Body) { $curlArgs += @("--data", $Body) }
    $curlArgs += $Url
    $output = & curl.exe @curlArgs 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Vercel API failed: $output" }
    if (-not $output) { return $null }
    return ($output -join "`n") | ConvertFrom-Json
}

function Merge-EnvMaps {
    param([hashtable]$Base, [hashtable]$Overlay)
    foreach ($key in $Overlay.Keys) {
        $value = $Overlay[$key]
        if ($value) { $Base[$key] = $value }
    }
    return $Base
}

$vars = @{}
if ($ExtraEnvFile) {
    $vars = Read-DotEnvFile (Join-Path $repoRoot $ExtraEnvFile)
}
foreach ($file in $EnvFiles) {
    $path = Join-Path $repoRoot $file
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Warning "Missing env file: $file (skipped)"
        continue
    }
    $vars = Merge-EnvMaps -Base $vars -Overlay (Read-DotEnvFile $path)
}

$syncKeys = @(
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
    "POSTGRES_URL",
    "AUTH_SECRET",
    "DEFAULT_OFFICE_SSIDS",
    "ADMIN_EMAIL",
    "BREAKGLASS_EMAIL",
    "BREAKGLASS_PASSWORD",
    "ALLOW_REGISTRATION",
    "POWER_AUTOMATE_WEBHOOK_URL",
    "POWER_AUTOMATE_WEBHOOK_SECRET",
    "CRON_SECRET"
)

$toSet = [ordered]@{}
foreach ($key in $syncKeys) {
    if ($vars.ContainsKey($key) -and $vars[$key]) {
        $toSet[$key] = $vars[$key]
    }
}

if (-not $toSet["POSTGRES_PRISMA_URL"]) {
    throw "POSTGRES_PRISMA_URL missing. For dev: npx vercel env pull .env.vercel.dev.local (Hobby office-tracker-dev). For prod: copy Neon vars into .env.vercel.local from Hobby office-tracker Storage."
}

if (-not $toSet["AUTH_SECRET"]) {
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $toSet["AUTH_SECRET"] = [Convert]::ToBase64String($bytes)
    Write-Warning "AUTH_SECRET was missing locally; generated a new one for Enterprise $Profile (users must sign in again on this URL)."
}

$toSet["NEXT_PUBLIC_APP_URL"] = $AppUrl
$toSet["RUN_DB_SETUP_ON_DEPLOY"] = $RunDbSetupOnDeploy
$toSet["SCHEMA_AUTO_MIGRATE"] = "false"

Write-Host "Profile: $Profile" -ForegroundColor Cyan
Write-Host "Syncing $($toSet.Count) env vars to $ProjectName on team $TeamId" -ForegroundColor Cyan

$existing = Invoke-VercelJson -Method GET -Url "https://api.vercel.com/v9/projects/$([Uri]::EscapeDataString($ProjectName))/env?teamId=$([Uri]::EscapeDataString($TeamId))"
$existingByKey = @{}
if ($existing.envs) {
    foreach ($row in $existing.envs) { $existingByKey[$row.key] = $row }
}

foreach ($entry in $toSet.GetEnumerator()) {
    $key = $entry.Key
    $value = $entry.Value
    $type = if ($key -match "SECRET|PASSWORD|AUTH_|POSTGRES|TOKEN|CRON") { "encrypted" } else { "plain" }
    $body = @{
        key = $key
        value = $value
        type = $type
        target = @("production", "preview", "development")
    } | ConvertTo-Json -Compress

    if ($existingByKey.ContainsKey($key)) {
        $envId = $existingByKey[$key].id
        $url = "https://api.vercel.com/v9/projects/$([Uri]::EscapeDataString($ProjectName))/env/$envId" +
            "?teamId=$([Uri]::EscapeDataString($TeamId))"
        Invoke-VercelJson -Method PATCH -Url $url -Body $body | Out-Null
        Write-Host "  Updated $key" -ForegroundColor Green
    } else {
        $url = "https://api.vercel.com/v10/projects/$([Uri]::EscapeDataString($ProjectName))/env?teamId=$([Uri]::EscapeDataString($TeamId))"
        Invoke-VercelJson -Method POST -Url $url -Body $body | Out-Null
        Write-Host "  Created $key" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Git: set Production Branch to '$ProductionBranch' in Vercel → Project → Git (API cannot change this on Enterprise)." -ForegroundColor Yellow
Write-Host "Done. Redeploy or push to $ProductionBranch." -ForegroundColor Green
Write-Host "App URL: $AppUrl" -ForegroundColor Cyan
