# My Office Pulse agent updater. Thin wrapper around setup.ps1 (IEX bypass for PwC laptops).
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

if (-not (Get-Command Invoke-AgentScriptBypass -ErrorAction SilentlyContinue)) {
    foreach ($path in @(
        (Join-Path $PSScriptRoot "lib\agent-download.ps1"),
        (Join-Path $PSScriptRoot "agent-download.ps1"),
        (Join-Path $env:LOCALAPPDATA "OfficeTracker\lib\agent-download.ps1")
    )) {
        if (Test-Path -LiteralPath $path) {
            . $path
            break
        }
    }
    if (-not (Get-Command Invoke-AgentScriptBypass -ErrorAction SilentlyContinue)) {
        throw "agent-download.ps1 module not found"
    }
}

$setupPath = Join-Path $PSScriptRoot "setup.ps1"
if (-not (Test-Path -LiteralPath $setupPath)) {
    $setupPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\setup.ps1"
}
if (-not (Test-Path -LiteralPath $setupPath)) {
    if (-not $Silent) { Write-Host "ERROR: setup.ps1 not found." -ForegroundColor Red }
    exit 1
}

$bound = @{}
if ($ApiUrl) { $bound.ApiUrl = $ApiUrl }
if ($Token) { $bound.Token = $Token }
if ($Silent) { $bound.Silent = $true }
if ($Verbose) { $bound.Verbose = $true }
if ($Force) { $bound.Force = $true }

$exitCode = Invoke-AgentScriptBypass -Ps1Path $setupPath -BoundVars $bound -Wait -Hidden:($Silent)
exit $exitCode
