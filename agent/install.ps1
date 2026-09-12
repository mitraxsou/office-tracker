# My Office Pulse installer. Thin wrapper around setup.ps1 (IEX bypass for PwC laptops).
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

function Import-AgentDownloadModule {
    $candidates = @(
        (Join-Path $PSScriptRoot "lib\agent-download.ps1"),
        (Join-Path $PSScriptRoot "agent-download.ps1"),
        (Join-Path $env:LOCALAPPDATA "OfficeTracker\lib\agent-download.ps1")
    )
    foreach ($path in $candidates) {
        if (Test-Path -LiteralPath $path) {
            . $path
            return
        }
    }
    throw "agent-download.ps1 module not found"
}

Import-AgentDownloadModule

$setupPath = Join-Path $PSScriptRoot "setup.ps1"
if (-not (Test-Path -LiteralPath $setupPath)) {
    $setupPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\setup.ps1"
}
if (-not (Test-Path -LiteralPath $setupPath)) {
    Write-Host "ERROR: setup.ps1 not found." -ForegroundColor Red
    exit 1
}

$bound = @{
    ApiUrl = $ApiUrl
    Token  = $Token
}
if ($RequireAdmin) { $bound.RequireAdmin = $true }

$exitCode = Invoke-AgentScriptBypass -Ps1Path $setupPath -BoundVars $bound -Wait
exit $exitCode
