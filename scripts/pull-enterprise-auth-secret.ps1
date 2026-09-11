#Requires -Version 5.1
<#
.SYNOPSIS
  Pull AUTH_SECRET from an Enterprise Vercel project into local gitignored env files.

.EXAMPLE
  $env:VERCEL_TOKEN = "your-token"
  .\scripts\pull-enterprise-auth-secret.ps1 -Profile prod
#>
[CmdletBinding()]
param(
    [ValidateSet("dev", "prod")]
    [string]$Profile = "prod"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$projects = @{
    dev  = @{ Id = "prj_lhha3DVceqlTtU2A4HGdNaM32Sk6"; LocalFile = ".env.vercel.enterprise.dev.local" }
    prod = @{ Id = "prj_N8idhB3WNItVngojCQAmOT5bsnSI"; LocalFile = ".env.vercel.enterprise.prod.local" }
}

$selected = $projects[$Profile]
$repoRoot = Split-Path -Parent $PSScriptRoot
$targetPath = Join-Path $repoRoot $selected.LocalFile
$tempPath = Join-Path $repoRoot ".env.enterprise.pull.tmp"

$env:VERCEL_ORG_ID = "team_aibOHBi06MpPxWdFWRGDp9iK"
$env:VERCEL_PROJECT_ID = $selected.Id
$env:NODE_TLS_REJECT_UNAUTHORIZED = "0"

& npx vercel env pull $tempPath --environment=production --yes | Out-Null
if (-not (Test-Path -LiteralPath $tempPath)) {
    throw "vercel env pull failed"
}

$authLine = Get-Content -LiteralPath $tempPath | Where-Object { $_ -match '^AUTH_SECRET=' } | Select-Object -First 1
Remove-Item -LiteralPath $tempPath -Force
if (-not $authLine) {
    throw "AUTH_SECRET not found in pulled env"
}

$lines = @()
if (Test-Path -LiteralPath $targetPath) {
    $lines = Get-Content -LiteralPath $targetPath
    $lines = $lines | Where-Object { $_ -notmatch '^AUTH_SECRET=' }
}
$lines += $authLine
$lines | Set-Content -LiteralPath $targetPath -Encoding utf8
Write-Host "Saved AUTH_SECRET to $($selected.LocalFile) (gitignored). Future sync-enterprise-env runs will not rotate it."
