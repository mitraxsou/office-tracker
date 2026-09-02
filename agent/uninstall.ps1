# PwC Office Pulse uninstaller. No admin for default user-level install.

$ErrorActionPreference = "Stop"
$LegacyTaskNames = @("OfficeTrackerHeartbeat", "PwCOfficePulse", "PwCOfficePulseUpdate")
$LegacyStartupShortcuts = @("OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk")

function Write-UninstallLog([string]$Message) {
    $logDir = Join-Path $env:LOCALAPPDATA "OfficeTracker\logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = Join-Path $logDir "uninstall.log"
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Get-LaptopSerial {
    try {
        $serial = (Get-CimInstance Win32_Bios -ErrorAction Stop).SerialNumber
        if ($serial) { return $serial.Trim() }
    } catch {}
    try {
        $serial = (Get-WmiObject Win32_Bios -ErrorAction Stop).SerialNumber
        if ($serial) { return $serial.Trim() }
    } catch {}
    return $null
}

function Send-LifecycleUninstall {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$SerialNumber
    )
    if (-not $ApiUrl -or -not $Token -or -not $SerialNumber) {
        Write-UninstallLog "WARN lifecycle skip: missing apiUrl, token, or serial"
        return
    }
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $versionPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\version.txt"
        $scriptVersion = if (Test-Path $versionPath) { (Get-Content $versionPath -Raw).Trim() } else { $null }
        $payload = @{
            token        = $Token
            serialNumber = $SerialNumber
            event        = "uninstall"
            hostname     = $env:COMPUTERNAME
            scriptVersion = $scriptVersion
        } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$($ApiUrl.TrimEnd('/'))/api/agent/lifecycle" -Method POST `
            -ContentType "application/json" -Body $payload -TimeoutSec 20 | Out-Null
        Write-UninstallLog "OK lifecycle uninstall reported"
    } catch {
        Write-UninstallLog "WARN lifecycle POST failed: $($_.Exception.Message)"
    }
}

Write-Host "Uninstalling PwC Office Pulse..."

$configPath = Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"
if (Test-Path $configPath) {
    try {
        $config = Get-Content $configPath -Raw | ConvertFrom-Json
        $apiUrl = [string]$config.apiUrl
        $token = [string]$config.token
        $serial = Get-LaptopSerial
        if (-not $serial -and $config.serialNumber) { $serial = [string]$config.serialNumber }
        Send-LifecycleUninstall -ApiUrl $apiUrl -Token $token -SerialNumber $serial
    } catch {
        Write-UninstallLog "WARN could not read config for lifecycle: $($_.Exception.Message)"
    }
}

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
Write-Host "Done. Visit history stays in the web app." -ForegroundColor Green
