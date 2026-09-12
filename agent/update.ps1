# My Office Pulse agent updater. Thin wrapper around setup.ps1.
#
# Usage:
#   .\update.ps1
#   .\update.ps1 -ApiUrl "https://..." -Token "..." -Silent
#   .\update.ps1 -Verbose
#   .\update.ps1 -Force

param(
    [string]$ApiUrl,
    [string]$Token,
    [switch]$Silent,
    [switch]$Verbose,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$setupPath = Join-Path $PSScriptRoot "setup.ps1"
if (-not (Test-Path -LiteralPath $setupPath)) {
    $setupPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\setup.ps1"
}
if (-not (Test-Path -LiteralPath $setupPath)) {
    if (-not $Silent) { Write-Host "ERROR: setup.ps1 not found." -ForegroundColor Red }
    exit 1
}

& $setupPath -ApiUrl $ApiUrl -Token $Token -Silent:$Silent -Verbose:$Verbose -Force:$Force
