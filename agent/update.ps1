# Office Tracker agent updater. Copies latest scripts from GitHub clone to install dir.
# NO admin required.
#
# One-time setup: clone the repo once:
#   git clone https://github.com/mitraxsou/office-tracker.git %USERPROFILE%\OfficeTracker-repo
#
# Then run this script (or schedule it weekly):
#   powershell -ExecutionPolicy Bypass -File "%LOCALAPPDATA%\OfficeTracker\update.ps1"
#
# Optional: pass -RepoPath if your clone is elsewhere:
#   .\update.ps1 -RepoPath "C:\Users\you\OfficeTracker-repo"

param(
    [string]$RepoPath = (Join-Path $env:USERPROFILE "OfficeTracker-repo")
)

$ErrorActionPreference = "Stop"
$TaskName = "PwCOfficePulse"
$installDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"

Write-Host "Office Tracker agent updater"
Write-Host "Repo:    $RepoPath"
Write-Host "Install: $installDir"
Write-Host ""

if (-not (Test-Path $RepoPath)) {
    Write-Host "ERROR: Repo not found at $RepoPath" -ForegroundColor Red
    Write-Host "Clone first: git clone https://github.com/mitraxsou/office-tracker.git `"$RepoPath`""
    exit 1
}

Push-Location $RepoPath
try {
    Write-Host "Pulling latest from GitHub..."
    git pull --ff-only 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: git pull failed. Copying local files anyway." -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$agentSource = Join-Path $RepoPath "agent"
Copy-Item (Join-Path $agentSource "office-heartbeat.ps1") (Join-Path $installDir "office-heartbeat.ps1") -Force
Copy-Item (Join-Path $agentSource "update.ps1") (Join-Path $installDir "update.ps1") -Force
Write-Host "Copied latest agent scripts to $installDir"

# Restart scheduled task to pick up changes
$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Start-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Write-Host "Restarted scheduled task: $TaskName"
} else {
    Write-Host "No scheduled task found. Run install.ps1 if not yet installed."
}

Write-Host ""
Write-Host "Update complete." -ForegroundColor Green
