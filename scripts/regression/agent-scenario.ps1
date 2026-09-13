# Simulates agent scenarios against the regression install dir without touching OfficeTracker.
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet("home_wifi", "office_arrival", "office_departure", "sleep_wake", "day_rollover")]
    [string]$Scenario,

    [switch]$DryRun,
    [switch]$Live,
    [string]$ApiUrl,
    [string]$Token,
    [string]$Serial = "REGRESSION-LAPTOP-01",
    [string]$OfficeSsid = "OfficeConnect",
    [string]$HomeSsid = "HomeWiFi"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$InstallDir = Join-Path $env:LOCALAPPDATA "OfficeTracker-Regression"
$env:OFFICETRACKER_INSTALL_DIR = $InstallDir

function Ensure-RegressionInstall {
    param([string]$ApiUrl, [string]$Token, [string]$Serial)
    $stateDir = Join-Path $InstallDir "state"
    $logsDir = Join-Path $InstallDir "logs"
    New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null

    $configPath = Join-Path $InstallDir "config.json"
    if (-not (Test-Path -LiteralPath $configPath)) {
        if (-not $ApiUrl -or -not $Token) {
            throw "config.json missing. Pass -ApiUrl and -Token or run create-regression-user.ts first."
        }
        @{
            apiUrl = $ApiUrl.TrimEnd("/")
            token = $Token
            serialNumber = $Serial
        } | ConvertTo-Json | Set-Content -Path $configPath -Encoding UTF8
    }

    $agentDir = Join-Path $RepoRoot "agent"
    foreach ($rel in @("office-heartbeat.ps1", "version.txt", "lib\agent-storage.ps1", "lib\agent-download.ps1")) {
        $src = Join-Path $agentDir $rel
        $dest = Join-Path $InstallDir $rel
        $destParent = Split-Path $dest -Parent
        if (-not (Test-Path $destParent)) { New-Item -ItemType Directory -Path $destParent -Force | Out-Null }
        Copy-Item -LiteralPath $src -Destination $dest -Force
    }

    $versionSrc = Join-Path $agentDir "version.txt"
    if (Test-Path $versionSrc) {
        Copy-Item -LiteralPath $versionSrc -Destination (Join-Path $InstallDir "version.txt") -Force
    }
}

function Write-JsonFile([string]$Path, $Object) {
    $Object | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-IsoOffset([int]$MinutesAgo = 0) {
    (Get-Date).AddMinutes(-$MinutesAgo).ToUniversalTime().ToString("o")
}

function New-EventId { return [guid]::NewGuid().ToString() }

function Apply-ScenarioState {
    param(
        [string]$Scenario,
        [string]$OfficeSsid,
        [string]$HomeSsid
    )

    $stateDir = Join-Path $InstallDir "state"
    $presencePath = Join-Path $stateDir "presence.json"
    $syncPath = Join-Path $stateDir "sync-state.json"
    $queuePath = Join-Path $stateDir "event-queue.json"
    $lastRunPath = Join-Path $InstallDir "last-run.txt"

    $now = Get-Date
    $dayKey = $now.ToString("yyyy-MM-dd")
    $yesterdayKey = $now.AddDays(-1).ToString("yyyy-MM-dd")

    switch ($Scenario) {
        "home_wifi" {
            Write-JsonFile $presencePath @{ ssid = $HomeSsid; updatedAt = Get-IsoOffset(5) }
            Write-JsonFile $syncPath @{
                dayKey = $dayKey
                dayOfficeMs = 0
                dayVisitCount = 0
                lastActivityTickAt = Get-IsoOffset(10)
                lastSyncAt = Get-IsoOffset(10)
            }
            Write-JsonFile $queuePath @{ events = @() }
        }
        "office_arrival" {
            Write-JsonFile $presencePath @{ ssid = $HomeSsid; updatedAt = Get-IsoOffset(30) }
            Write-JsonFile $syncPath @{
                dayKey = $dayKey
                dayOfficeMs = 0
                dayVisitCount = 0
            }
            Write-JsonFile $queuePath @{ events = @() }
            Set-Content -Path $lastRunPath -Value (Get-Date).AddMinutes(-30).ToString("o") -Encoding UTF8
            $env:OT_SCENARIO_SSID = $OfficeSsid
        }
        "office_departure" {
            $visitId = New-EventId
            Write-JsonFile $presencePath @{ ssid = $OfficeSsid; updatedAt = Get-IsoOffset(60) }
            Write-JsonFile $syncPath @{
                dayKey = $dayKey
                dayOfficeMs = 4 * 60 * 60 * 1000
                dayVisitCount = 1
                openVisit = @{
                    localVisitId = $visitId
                    startAt = Get-IsoOffset(300)
                    ssid = $OfficeSsid
                }
            }
            Write-JsonFile $queuePath @{ events = @() }
            $env:OT_SCENARIO_SSID = $HomeSsid
        }
        "sleep_wake" {
            Write-JsonFile $presencePath @{ ssid = $HomeSsid; updatedAt = Get-IsoOffset(480) }
            Write-JsonFile $syncPath @{
                dayKey = $dayKey
                lastActivityTickAt = Get-IsoOffset(480)
                lastSyncAt = Get-IsoOffset(480)
            }
            Write-JsonFile $queuePath @{ events = @() }
            Set-Content -Path $lastRunPath -Value (Get-Date).AddHours(-8).ToString("o") -Encoding UTF8
            $env:OT_SCENARIO_SSID = $HomeSsid
        }
        "day_rollover" {
            $visitId = New-EventId
            Write-JsonFile $presencePath @{ ssid = $OfficeSsid; updatedAt = Get-IsoOffset(2) }
            Write-JsonFile $syncPath @{
                dayKey = $yesterdayKey
                dayOfficeMs = 5 * 60 * 60 * 1000
                dayVisitCount = 1
                openVisit = @{
                    localVisitId = $visitId
                    startAt = (Get-Date).AddDays(-1).AddHours(-4).ToUniversalTime().ToString("o")
                    ssid = $OfficeSsid
                }
                lastDailySummaryDayKey = $null
            }
            Write-JsonFile $queuePath @{ events = @() }
            $env:OT_SCENARIO_SSID = $OfficeSsid
        }
    }
}

Ensure-RegressionInstall -ApiUrl $ApiUrl -Token $Token -Serial $Serial
Apply-ScenarioState -Scenario $Scenario -OfficeSsid $OfficeSsid -HomeSsid $HomeSsid

$heartbeatPath = Join-Path $InstallDir "office-heartbeat.ps1"
Write-Host "Scenario:      $Scenario"
Write-Host "Install dir:   $InstallDir"
Write-Host "DryRun:        $DryRun"
Write-Host ""

if ($Scenario -in @("office_arrival", "office_departure", "day_rollover")) {
    Write-Host "Tip: For SSID transition scenarios, toggle Wi-Fi or mock SSID before live heartbeat."
    Write-Host "     This harness seeds prior state; run heartbeat -DryRun to inspect queued events."
    Write-Host ""
}

if ($DryRun -or -not $Live) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $heartbeatPath -DryRun
    exit $LASTEXITCODE
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $heartbeatPath
exit $LASTEXITCODE
