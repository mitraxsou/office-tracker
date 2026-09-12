# My Office Pulse installer. Thin wrapper around setup.ps1.
#
# Usage:
#   .\install.ps1 -ApiUrl "https://your-app.vercel.app" -Token "your-agent-token-from-settings"

param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [switch]$RequireAdmin
)

$ErrorActionPreference = "Stop"

$setupPath = Join-Path $PSScriptRoot "setup.ps1"
if (-not (Test-Path -LiteralPath $setupPath)) {
    $setupPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\setup.ps1"
}
if (-not (Test-Path -LiteralPath $setupPath)) {
    Write-Host "ERROR: setup.ps1 not found." -ForegroundColor Red
    exit 1
}

& $setupPath -ApiUrl $ApiUrl -Token $Token -RequireAdmin:$RequireAdmin
