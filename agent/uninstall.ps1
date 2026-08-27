# PwC Office Pulse uninstaller — NO admin required for default user-level install.

$ErrorActionPreference = "Stop"
$LegacyTaskNames = @("OfficeTrackerHeartbeat", "PwCOfficePulse")
$LegacyStartupShortcuts = @("OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk")

Write-Host "Uninstalling PwC Office Pulse..."

foreach ($task in $LegacyTaskNames) {
    Unregister-ScheduledTask -TaskName $task -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "  Removed scheduled task (if present): $task"
}

$startupDir = [Environment]::GetFolderPath("Startup")
foreach ($name in $LegacyStartupShortcuts) {
    $shortcut = Join-Path $startupDir $name
    if (Test-Path $shortcut) {
        Remove-Item $shortcut -Force
        Write-Host "  Removed Startup shortcut: $name"
    }
}

$userDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
if (Test-Path $userDir) {
    Remove-Item $userDir -Recurse -Force
    Write-Host "  Removed $userDir"
}

$programDir = "C:\Program Files\OfficeTracker"
if ((Test-Path $programDir) -and ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Remove-Item $programDir -Recurse -Force
    Write-Host "  Removed $programDir"
} elseif (Test-Path $programDir) {
    Write-Host "  Note: $programDir exists but requires admin to remove."
}

Write-Host ""
Write-Host "Uninstall complete. Your visit history remains in the web app." -ForegroundColor Green
