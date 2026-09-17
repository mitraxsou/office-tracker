# One-shot connectivity test: config fetch + sync (no scheduled task required).
# Usage:
#   From installed agent:  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\OfficeTracker\test-connection.ps1"
#   From zip folder (after install): same path under %LOCALAPPDATA%\OfficeTracker

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-InstallDir {
    if ($env:OFFICETRACKER_INSTALL_DIR) { return $env:OFFICETRACKER_INSTALL_DIR }
    return Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

$configPath = Join-Path (Get-InstallDir) "config.json"
if (-not (Test-Path -LiteralPath $configPath)) {
    Write-Host "ERROR: config.json not found at $configPath" -ForegroundColor Red
    Write-Host "Run the reinstall command from Settings first." -ForegroundColor Yellow
    exit 1
}

$cfg = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$apiUrl = [string]$cfg.apiUrl
$token = [string]$cfg.token
if (-not $apiUrl -or -not $token) {
    Write-Host "ERROR: config.json is missing apiUrl or token." -ForegroundColor Red
    exit 1
}

$installDir = Get-InstallDir
foreach ($rel in @("lib\agent-download.ps1", "lib\agent-storage.ps1", "office-heartbeat.ps1")) {
    $p = Join-Path $installDir $rel
    if (Test-Path -LiteralPath $p) {
        Unblock-File -LiteralPath $p -ErrorAction SilentlyContinue
        if ($rel -like "lib\*") { . $p }
    }
}

$version = "unknown"
$versionPath = Join-Path $installDir "version.txt"
if (Test-Path -LiteralPath $versionPath) {
    $version = (Get-Content -LiteralPath $versionPath -Raw).Trim()
}

Write-Host "My Office Pulse connection test" -ForegroundColor Cyan
Write-Host "  Local agent:  v$version"
Write-Host "  Server:       $apiUrl"
Write-Host ""

$headers = @{ Authorization = "Bearer $token" }
try {
    $cfgUri = "$($apiUrl.TrimEnd('/'))/api/agent/config"
    $serial = $null
    if (Get-Command Get-LaptopSerial -ErrorAction SilentlyContinue) {
        $serial = Get-LaptopSerial
        if ($serial) {
            $cfgUri = "${cfgUri}?serialNumber=$([Uri]::EscapeDataString($serial))"
        }
    }
    $remote = Invoke-RestMethod -Uri $cfgUri -Headers $headers -TimeoutSec 45
    $serverVer = [string]$remote.agentScriptVersion
    Write-Host "OK config" -ForegroundColor Green
    Write-Host "  Server agent bundle: v$serverVer"
    if ($serial) { Write-Host "  Laptop serial:       $serial" }
} catch {
    Write-Host "FAIL config: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path -LiteralPath (Join-Path $installDir "office-heartbeat.ps1"))) {
    Write-Host "WARN office-heartbeat.ps1 missing; skipping sync run." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Running one agent sync cycle..." -ForegroundColor Cyan
$hb = Join-Path $installDir "office-heartbeat.ps1"
$code = 0
if (Get-Command Invoke-AgentScriptBypass -ErrorAction SilentlyContinue) {
    $code = Invoke-AgentScriptBypass -Ps1Path $hb -BoundVars @{} -Wait
} else {
    & $hb
    if ($null -ne $LASTEXITCODE) { $code = $LASTEXITCODE }
}

$logPath = Join-Path $installDir "logs\heartbeat.log"
if (Test-Path -LiteralPath $logPath) {
    $tail = Get-Content -LiteralPath $logPath -Tail 8 -ErrorAction SilentlyContinue
    if ($tail) {
        Write-Host ""
        Write-Host "Recent heartbeat.log:" -ForegroundColor Gray
        $tail | ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
    }
}

if ($code -eq 0) {
    Write-Host ""
    Write-Host "OK sync cycle finished (exit 0). Check Settings for last seen / activity." -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "Sync cycle exited with code $code. See logs\heartbeat.log" -ForegroundColor Yellow
    exit $code
}
