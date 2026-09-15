# Office Tracker heartbeat agent (event mode v1.3)
# Tracks Wi-Fi changes locally, queues events, syncs via POST /api/agent/sync.
# Falls back to POST /api/heartbeat when sync is not deployed yet.

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
# Fetch /api/agent/config every N task runs (~2 min each). 60 runs ~= 2 h between polls.
$ConfigFetchIntervalRuns = 60
$ConfigCacheMaxAgeMinutes = 120
$UpdateCheckIntervalMinutes = 60
$AgentScriptVersion = "1.5.2"

function Get-InstallDir {
    if ($env:OFFICETRACKER_INSTALL_DIR) {
        return [string]$env:OFFICETRACKER_INSTALL_DIR
    }
    Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

function Write-Log([string]$Message) {
    $logDir = Join-Path (Get-InstallDir) "logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = Join-Path $logDir "heartbeat.log"
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Get-StateDir {
    $dir = Join-Path (Get-InstallDir) "state"
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    return $dir
}

function Get-PresencePath { Join-Path (Get-StateDir) "presence.json" }
function Get-EventQueuePath { Join-Path (Get-StateDir) "event-queue.json" }
function Get-SyncStatePath { Join-Path (Get-StateDir) "sync-state.json" }
function Get-ConfigPath { Join-Path (Get-InstallDir) "config.json" }
function Get-CachePath { Join-Path (Get-InstallDir) "server-config.json" }
function Get-RunCounterPath { Join-Path (Get-InstallDir) "run-counter.txt" }
function Get-LastRunPath { Join-Path (Get-InstallDir) "last-run.txt" }
function Get-LastUpdateCheckPath { Join-Path (Get-InstallDir) "last-update-check.txt" }
function Get-VersionPath { Join-Path (Get-InstallDir) "version.txt" }

function Get-LocalAgentVersion {
    $path = Get-VersionPath
    if (Test-Path $path) {
        $fromFile = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if ($fromFile) {
            $trimmed = $fromFile.Trim()
            if ($trimmed -match '^\d+(\.\d+){0,3}$') { return $trimmed }
        }
    }
    return $AgentScriptVersion
}

Write-Log "START v$(Get-LocalAgentVersion) event-mode"

function Invoke-LocalStorageMaintenance {
    if (-not (Get-Command Invoke-AgentStorageMaintenance -ErrorAction SilentlyContinue)) { return }
    $queue = @(Get-EventQueue)
    $result = Invoke-AgentStorageMaintenance -Log { param($m) Write-Log $m } -Events $queue
    if ($result.events.Count -ne $queue.Count) {
        Set-EventQueue @($result.events)
    }
}

function Get-LastRunTime {
    $path = Get-LastRunPath
    if (-not (Test-Path $path)) { return $null }
    try { return [DateTime]::Parse((Get-Content $path -Raw).Trim()) } catch { return $null }
}

function Set-LastRunTime {
    Set-Content -Path (Get-LastRunPath) -Value (Get-Date -Format "o") -Encoding UTF8
}

function Test-ResumeFromSleep {
    $last = Get-LastRunTime
    if (-not $last) { return $false }
    return ((Get-Date) - $last).TotalMinutes -gt 5
}

function Compare-AgentVersion {
    param([string]$Left, [string]$Right)
    if (Get-Command Normalize-AgentVersionString -ErrorAction SilentlyContinue) {
        $parse = {
            param([string]$v)
            $normalized = Normalize-AgentVersionString $v
            $normalized.Split(".") | ForEach-Object {
                $part = 0
                [void][int]::TryParse($_, [ref]$part)
                $part
            }
        }
    } else {
        $parse = {
            param([string]$v)
            $t = $v.Trim()
            if ($t -notmatch '^\d+(\.\d+){0,3}$') { $t = "0.0.0" }
            $t.Split(".") | ForEach-Object {
                $part = 0
                [void][int]::TryParse($_, [ref]$part)
                $part
            }
        }
    }
    $lv = @(& $parse $Left)
    $rv = @(& $parse $Right)
    $len = [Math]::Max($lv.Count, $rv.Count)
    for ($i = 0; $i -lt $len; $i++) {
        $l = if ($i -lt $lv.Count) { $lv[$i] } else { 0 }
        $r = if ($i -lt $rv.Count) { $rv[$i] } else { 0 }
        if ($l -gt $r) { return 1 }
        if ($l -lt $r) { return -1 }
    }
    return 0
}

function Get-RunCounter {
    $path = Get-RunCounterPath
    if (-not (Test-Path $path)) { return 0 }
    $val = Get-Content $path -Raw -ErrorAction SilentlyContinue
    if ($val -match '^\d+$') { return [int]$val }
    return 0
}

function Set-RunCounter([int]$Value) {
    Set-Content -Path (Get-RunCounterPath) -Value $Value -Encoding UTF8
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

function Test-ValidWifiSsid([string]$Ssid) {
    if (-not $Ssid) { return $false }
    $t = $Ssid.Trim()
    if (-not $t) { return $false }
    if ($t -match '^(?i)identifying\.{0,3}$') { return $false }
    if ($t -match '^(?i)unidentified network$') { return $false }
    return $true
}

function Normalize-WifiSsid([string]$Ssid) {
    if (-not (Test-ValidWifiSsid $Ssid)) { return $null }
    $normalized = $Ssid.Trim()
    $normalized = $normalized -replace '(?i)\s*\(unauthenticated\)\s*$', ''
    $normalized = $normalized -replace '\s+\d+$', ''
    $normalized = $normalized.Trim()
    if (-not $normalized) { return $null }
    return $normalized
}

function Get-WifiSsidFromNetsh {
    try {
        $output = netsh wlan show interfaces 2>$null
        if (-not $output) { return $null }

        $blocks = @()
        $currentBlock = @()
        foreach ($line in $output) {
            if ($line -match '^\s*$') {
                if ($currentBlock.Count -gt 0) {
                    $blocks += ,@($currentBlock)
                    $currentBlock = @()
                }
                continue
            }
            $currentBlock += $line
        }
        if ($currentBlock.Count -gt 0) { $blocks += ,@($currentBlock) }

        foreach ($block in $blocks) {
            $state = $null
            $ssid = $null
            foreach ($line in $block) {
                if ($line -match '^\s*State\s*:\s*(.+)$') { $state = $Matches[1].Trim() }
                if ($line -match '^\s*SSID\s*:\s*(.*)$' -and $line -notmatch 'BSSID') {
                    $ssid = $Matches[1].Trim()
                }
            }
            if ($state -match '(?i)connected' -and (Test-ValidWifiSsid $ssid)) {
                return $ssid
            }
        }

        foreach ($line in $output) {
            if ($line -match '^\s*SSID\s*:\s*(.+)$' -and $line -notmatch 'BSSID') {
                $ssid = $Matches[1].Trim()
                if (Test-ValidWifiSsid $ssid) { return $ssid }
            }
        }
    } catch {}
    return $null
}

function Get-CurrentWifiSsid {
    $netshSsid = Get-WifiSsidFromNetsh
    if ($netshSsid) {
        $normalized = Normalize-WifiSsid $netshSsid
        if ($normalized) { return @{ Ssid = $normalized; Method = "netsh" } }
    }

    try {
        $profile = Get-NetConnectionProfile -ErrorAction Stop |
            Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*' } |
            Select-Object -First 1
        if ($profile -and $profile.Name) {
            $normalized = Normalize-WifiSsid $profile.Name
            if ($normalized) { return @{ Ssid = $normalized; Method = "NetConnectionProfile" } }
        }
    } catch {}

    try {
        $wmi = Get-CimInstance -Namespace root/wmi -ClassName MSNdis_80211_ServiceSetIdentifier -ErrorAction Stop |
            Select-Object -First 1
        if ($wmi -and $wmi.Ndis80211Ssid.Ssid) {
            $raw = -join ($wmi.Ndis80211Ssid.Ssid | ForEach-Object {
                if ($_ -ge 32 -and $_ -le 126) { [char]$_ }
            })
            $normalized = Normalize-WifiSsid $raw
            if ($normalized) { return @{ Ssid = $normalized; Method = "WMI" } }
        }
    } catch {}

    return @{ Ssid = $null; Method = "none" }
}

function Get-CurrentWifiSsidWithRetry {
    param(
        [int]$MaxAttempts = 3,
        [int]$DelaySec = 5
    )
    $result = @{ Ssid = $null; Method = "none" }
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        $result = Get-CurrentWifiSsid
        if ($result.Ssid) { return $result }
        if ($attempt -lt $MaxAttempts) {
            Write-Log "WARN SSID empty on attempt $attempt; retrying in ${DelaySec}s"
            Start-Sleep -Seconds $DelaySec
        }
    }
    return $result
}

function Get-VpnGatewayDiagnostic {
    try {
        $gp = Get-Process -Name "PanGPA","GlobalProtect" -ErrorAction SilentlyContinue
        if ($gp) { return "GlobalProtect-Connected" }
    } catch {}
    return $null
}

function Wait-NetworkReady {
    param(
        [string]$ApiUrl,
        [int]$MaxWaitSec = 60
    )
    $hostName = ([Uri]$ApiUrl).Host
    $deadline = (Get-Date).AddSeconds($MaxWaitSec)
    while ((Get-Date) -lt $deadline) {
        try {
            [void][System.Net.Dns]::GetHostEntry($hostName)
            return $true
        } catch {}
        Start-Sleep -Seconds 3
    }
    Write-Log "WARN network not ready after ${MaxWaitSec}s; continuing anyway"
    return $false
}

function Get-HeartbeatIntervalMinutes($ServerConfig) {
    $interval = 5
    if ($ServerConfig -and $null -ne $ServerConfig.heartbeatIntervalMinutes) {
        $parsed = 0
        if ([int]::TryParse([string]$ServerConfig.heartbeatIntervalMinutes, [ref]$parsed)) {
            $interval = $parsed
        }
    }
    return [Math]::Max(2, [Math]::Min(60, $interval))
}

function Get-AgentTimezone($ServerConfig) {
    if ($ServerConfig -and $ServerConfig.timezone) {
        return [string]$ServerConfig.timezone
    }
    return "Asia/Kolkata"
}

function Get-DayKey([string]$TimezoneId) {
    try {
        $tz = [TimeZoneInfo]::FindSystemTimeZoneById($TimezoneId)
        $local = [TimeZoneInfo]::ConvertTimeFromUtc((Get-Date).ToUniversalTime(), $tz)
        return $local.ToString("yyyy-MM-dd")
    } catch {
        return (Get-Date).ToString("yyyy-MM-dd")
    }
}

function Get-NowIso {
    return (Get-Date).ToUniversalTime().ToString("o")
}

function New-EventId {
    return [Guid]::NewGuid().ToString("N")
}

function Read-JsonFile([string]$Path, $Default) {
    if (-not (Test-Path $Path)) { return $Default }
    try {
        return Get-Content $Path -Raw | ConvertFrom-Json
    } catch {
        return $Default
    }
}

function Write-JsonFile([string]$Path, $Object) {
    $Object | ConvertTo-Json -Depth 8 -Compress | Set-Content -Path $Path -Encoding UTF8
}

function Get-PresenceState {
    $default = @{ ssid = $null; updatedAt = $null }
    $data = Read-JsonFile (Get-PresencePath) $default
    return @{
        ssid = if ($data.ssid) { [string]$data.ssid } else { $null }
        updatedAt = if ($data.updatedAt) { [string]$data.updatedAt } else { $null }
    }
}

function Set-PresenceState([string]$Ssid) {
    Write-JsonFile (Get-PresencePath) @{
        ssid = $Ssid
        updatedAt = Get-NowIso
    }
}

function Get-EventQueue {
    $data = Read-JsonFile (Get-EventQueuePath) @{ events = @() }
    $events = @()
    if ($data.events) {
        foreach ($evt in $data.events) { $events += $evt }
    }
    return $events
}

function Set-EventQueue([array]$Events) {
    Write-JsonFile (Get-EventQueuePath) @{ events = $Events }
}

function Add-QueuedEvent {
    param(
        [string]$Type,
        [hashtable]$Fields = @{},
        [string]$At
    )
    $timestamp = if ($At) { $At } else { Get-NowIso }
    $evt = @{
        id = New-EventId
        type = $Type
        at = $timestamp
    }
    foreach ($key in $Fields.Keys) {
        if ($null -ne $Fields[$key]) { $evt[$key] = $Fields[$key] }
    }
    $queue = @(Get-EventQueue)
    $queue += $evt
    Set-EventQueue $queue
}

function Get-SyncState {
    $default = @{
        lastActivityTickAt = $null
        lastDailySummaryDayKey = $null
        lastSyncAt = $null
        dayKey = $null
        dayOfficeMs = 0
        dayVisitCount = 0
        dayLaptopActiveMs = 0
        uptimeSessionStartAt = $null
        firstAgentOnAt = $null
        openVisit = $null
        pendingSsid = $null
        pendingPreviousSsid = $null
        hoursMetSentDayKey = $null
    }
    $data = Read-JsonFile (Get-SyncStatePath) $default
    if ($data -is [hashtable]) { return $data }

    # ConvertFrom-Json returns a PSCustomObject; normalize to a mutable hashtable for PS 5.1.
    $state = @{}
    foreach ($key in $default.Keys) {
        if ($data.PSObject.Properties.Name -contains $key) {
            $val = $data.$key
            if ($key -eq "openVisit" -and $val) {
                $state[$key] = @{
                    localVisitId = [string]$val.localVisitId
                    startAt = [string]$val.startAt
                    ssid = [string]$val.ssid
                }
            } else {
                $state[$key] = $val
            }
        } else {
            $state[$key] = $default[$key]
        }
    }
    return $state
}

function Set-SyncState($State) {
    Write-JsonFile (Get-SyncStatePath) $State
}

function Test-IsOfficeSsid {
    param(
        [string]$Ssid,
        $ServerConfig
    )
    if (-not $Ssid) { return $false }
    if (-not $ServerConfig -or -not $ServerConfig.ssids) { return $false }
    foreach ($allowed in $ServerConfig.ssids) {
        if ([string]$allowed -eq $Ssid) { return $true }
    }
    return $false
}

function Get-OpenVisitFromState($SyncState) {
    if ($SyncState.openVisit) {
        return @{
            localVisitId = [string]$SyncState.openVisit.localVisitId
            startAt = [string]$SyncState.openVisit.startAt
            ssid = [string]$SyncState.openVisit.ssid
        }
    }
    return $null
}

function Start-LocalVisit {
    param(
        $SyncState,
        [string]$Ssid
    )
    $visitId = New-EventId
    $startAt = Get-NowIso
    $SyncState.openVisit = @{
        localVisitId = $visitId
        startAt = $startAt
        ssid = $Ssid
    }
    if ($null -eq $SyncState.dayVisitCount) { $SyncState.dayVisitCount = 0 }
    $SyncState.dayVisitCount = [int]$SyncState.dayVisitCount + 1
    Add-QueuedEvent -Type "visit_start" -Fields @{
        localVisitId = $visitId
        ssid = $Ssid
    }
    return $SyncState
}

function End-LocalVisit {
    param(
        $SyncState,
        [string]$EndAt,
        [string]$PreviousSsid
    )
    $open = Get-OpenVisitFromState $SyncState
    if (-not $open) { return $SyncState }
    $disconnectAt = if ($EndAt) { $EndAt } else { Get-NowIso }
    $start = [DateTime]::Parse($open.startAt)
    $end = [DateTime]::Parse($disconnectAt)
    $durationMs = [Math]::Max(0, [int](($end - $start).TotalMilliseconds))
    if ($null -eq $SyncState.dayOfficeMs) { $SyncState.dayOfficeMs = 0 }
    $SyncState.dayOfficeMs = [int]$SyncState.dayOfficeMs + $durationMs
    $fields = @{
        localVisitId = $open.localVisitId
        officeMs = $durationMs
    }
    if ($PreviousSsid) { $fields.previousSsid = $PreviousSsid }
    Add-QueuedEvent -Type "visit_end" -Fields $fields -At $disconnectAt
    $SyncState.openVisit = $null
    return $SyncState
}

function Add-WifiChangeEvents {
    param(
        [string]$PreviousSsid,
        [string]$CurrentSsid,
        [string]$At
    )
    $transitionAt = if ($At) { $At } else { Get-NowIso }
    $prevSet = [bool]$PreviousSsid
    $currSet = [bool]$CurrentSsid
    if (-not $prevSet -and $currSet) {
        Add-QueuedEvent -Type "wifi_connected" -Fields @{ ssid = $CurrentSsid } -At $transitionAt
    } elseif ($prevSet -and -not $currSet) {
        Add-QueuedEvent -Type "wifi_disconnected" -Fields @{ previousSsid = $PreviousSsid } -At $transitionAt
    } elseif ($prevSet -and $currSet -and $PreviousSsid -ne $CurrentSsid) {
        Add-QueuedEvent -Type "ssid_changed" -Fields @{
            ssid = $CurrentSsid
            previousSsid = $PreviousSsid
        } -At $transitionAt
    }
}

function Update-VisitBoundaries {
    param(
        $SyncState,
        [string]$PreviousSsid,
        [string]$CurrentSsid,
        $ServerConfig,
        [string]$TransitionAt
    )
    $wasOffice = Test-IsOfficeSsid -Ssid $PreviousSsid -ServerConfig $ServerConfig
    $isOffice = Test-IsOfficeSsid -Ssid $CurrentSsid -ServerConfig $ServerConfig
    if ($wasOffice -and -not $isOffice) {
        $disconnectAt = if ($TransitionAt) { $TransitionAt } else { Get-NowIso }
        $SyncState = End-LocalVisit -SyncState $SyncState -EndAt $disconnectAt -PreviousSsid $PreviousSsid
    }
    if (-not $wasOffice -and $isOffice) {
        $SyncState = Start-LocalVisit -SyncState $SyncState -Ssid $CurrentSsid
    }
    return $SyncState
}

function Get-UptimeSessionEndTime {
    param($SyncState)
    if ($SyncState.lastActivityTickAt) {
        try { return [DateTime]::Parse([string]$SyncState.lastActivityTickAt) } catch {}
    }
    $lastRun = Get-LastRunTime
    if ($lastRun) { return $lastRun }
    return Get-Date
}

function Close-UptimeSessionIfOpen {
    param(
        $SyncState,
        [DateTime]$EndAt
    )
    if (-not $SyncState.uptimeSessionStartAt) { return $SyncState }
    try {
        $start = [DateTime]::Parse([string]$SyncState.uptimeSessionStartAt)
        if ($EndAt -gt $start) {
            $delta = [int](($EndAt - $start).TotalMilliseconds)
            if ($null -eq $SyncState.dayLaptopActiveMs) { $SyncState.dayLaptopActiveMs = 0 }
            $SyncState.dayLaptopActiveMs = [int]$SyncState.dayLaptopActiveMs + $delta
        }
    } catch {}
    $SyncState.uptimeSessionStartAt = $null
    return $SyncState
}

function Start-UptimeSession {
    param(
        $SyncState,
        [string]$AtIso
    )
    if ($SyncState.uptimeSessionStartAt) { return $SyncState }
    $SyncState.uptimeSessionStartAt = $AtIso
    if (-not $SyncState.firstAgentOnAt) {
        $SyncState.firstAgentOnAt = $AtIso
    }
    return $SyncState
}

function Sync-UptimeForActivityRun {
    param(
        $SyncState,
        [switch]$IsResumeRun
    )
    $nowIso = Get-NowIso
    if ($IsResumeRun) {
        $endAt = Get-UptimeSessionEndTime -SyncState $SyncState
        $SyncState = Close-UptimeSessionIfOpen -SyncState $SyncState -EndAt $endAt
    }
    $SyncState = Start-UptimeSession -SyncState $SyncState -AtIso $nowIso
    return $SyncState
}

function Get-LaptopActiveMsSnapshot {
    param($SyncState)
    $total = if ($null -ne $SyncState.dayLaptopActiveMs) { [int]$SyncState.dayLaptopActiveMs } else { 0 }
    if ($SyncState.uptimeSessionStartAt) {
        try {
            $start = [DateTime]::Parse([string]$SyncState.uptimeSessionStartAt)
            $total += [int](((Get-Date) - $start).TotalMilliseconds)
        } catch {}
    }
    return [Math]::Max(0, $total)
}

function Get-UptimeEventFields {
    param($SyncState)
    $fields = @{ laptopActiveMs = (Get-LaptopActiveMsSnapshot -SyncState $SyncState) }
    if ($SyncState.firstAgentOnAt) {
        $fields.firstAgentOnAt = [string]$SyncState.firstAgentOnAt
    }
    return $fields
}

function Reset-UptimeDayFields {
    param($SyncState)
    $SyncState.dayLaptopActiveMs = 0
    $SyncState.uptimeSessionStartAt = $null
    $SyncState.firstAgentOnAt = $null
    return $SyncState
}

function Test-ActivityTickDue {
    param(
        $SyncState,
        [int]$IntervalMinutes
    )
    if (-not $SyncState.lastActivityTickAt) { return $true }
    try {
        $last = [DateTime]::Parse([string]$SyncState.lastActivityTickAt)
        return ((Get-Date) - $last).TotalMinutes -ge $IntervalMinutes
    } catch {
        return $true
    }
}

function Maybe-EnqueueDailySummary {
    param(
        $SyncState,
        [string]$DayKey
    )
    $previousDayKey = if ($SyncState.dayKey) { [string]$SyncState.dayKey } else { $null }
    if ($previousDayKey -and $previousDayKey -ne $DayKey) {
        if ($SyncState.lastDailySummaryDayKey -ne $previousDayKey) {
            $endAt = Get-UptimeSessionEndTime -SyncState $SyncState
            $SyncState = Close-UptimeSessionIfOpen -SyncState $SyncState -EndAt $endAt
            $summaryOfficeMs = if ($null -ne $SyncState.dayOfficeMs) { [int]$SyncState.dayOfficeMs } else { 0 }
            $summaryVisitCount = if ($null -ne $SyncState.dayVisitCount) { [int]$SyncState.dayVisitCount } else { 0 }
            $summaryFields = @{
                dayKey = $previousDayKey
                officeMs = $summaryOfficeMs
                visitCount = $summaryVisitCount
                laptopActiveMs = (Get-LaptopActiveMsSnapshot -SyncState $SyncState)
            }
            if ($SyncState.firstAgentOnAt) {
                $summaryFields.firstAgentOnAt = [string]$SyncState.firstAgentOnAt
            }
            Add-QueuedEvent -Type "daily_summary" -Fields $summaryFields
            $SyncState.lastDailySummaryDayKey = $previousDayKey
        }
        $SyncState.dayOfficeMs = 0
        $SyncState.dayVisitCount = 0
        $SyncState.hoursMetSentDayKey = $null
        $SyncState = Reset-UptimeDayFields -SyncState $SyncState
    }
    $SyncState.dayKey = $DayKey
    return $SyncState
}

function Get-CurrentDayOfficeMs {
    param($SyncState)
    $total = if ($null -ne $SyncState.dayOfficeMs) { [int]$SyncState.dayOfficeMs } else { 0 }
    $open = Get-OpenVisitFromState $SyncState
    if ($open) {
        try {
            $start = [DateTime]::Parse([string]$open.startAt)
            $total += [Math]::Max(0, [int](((Get-Date) - $start).TotalMilliseconds))
        } catch {}
    }
    return [Math]::Max(0, $total)
}

function Get-HoursTargetMs {
    param($ServerConfig)
    $hours = 5
    if ($ServerConfig -and $null -ne $ServerConfig.hoursTarget) {
        $hours = [double]$ServerConfig.hoursTarget
    }
    if ($hours -le 0) { $hours = 5 }
    return [int]($hours * 60 * 60 * 1000)
}

function Maybe-EnqueueHoursTargetMet {
    param(
        $SyncState,
        [string]$DayKey,
        $ServerConfig
    )
    if ($SyncState.hoursMetSentDayKey -and [string]$SyncState.hoursMetSentDayKey -eq $DayKey) {
        return $SyncState
    }
    $targetMs = Get-HoursTargetMs -ServerConfig $ServerConfig
    $officeMs = Get-CurrentDayOfficeMs -SyncState $SyncState
    if ($officeMs -lt $targetMs) { return $SyncState }
    Add-QueuedEvent -Type "hours_target_met" -Fields @{
        dayKey = $DayKey
        officeMs = $officeMs
    }
    $SyncState.hoursMetSentDayKey = $DayKey
    Write-Log "hours_target_met officeMs=$officeMs targetMs=$targetMs"
    return $SyncState
}

function Fetch-ServerConfig([string]$ApiUrl, [string]$Token, [string]$SerialNumber) {
    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "$ApiUrl/api/agent/config"
    if ($SerialNumber) {
        $encoded = [Uri]::EscapeDataString($SerialNumber)
        $uri = "${uri}?serialNumber=$encoded"
    }
    $response = Invoke-RestMethod -Uri $uri -Method GET `
        -Headers $headers -TimeoutSec 30
    $response | ConvertTo-Json -Compress | Set-Content -Path (Get-CachePath) -Encoding UTF8
    return $response
}

function Test-ConfigCacheFresh([string]$CachePath) {
    if (-not (Test-Path $CachePath)) { return $false }
    try {
        $mtime = (Get-Item -LiteralPath $CachePath).LastWriteTime
        return ((Get-Date) - $mtime).TotalMinutes -lt $ConfigCacheMaxAgeMinutes
    } catch {
        return $false
    }
}

function Get-ServerConfig([string]$ApiUrl, [string]$Token, [string]$SerialNumber, [switch]$Force) {
    $cachePath = Get-CachePath
    $counter = Get-RunCounter
    $shouldFetch = $Force -or $counter -eq 0 -or ($counter % $ConfigFetchIntervalRuns -eq 0)
    if ($shouldFetch -and -not $Force -and (Test-ConfigCacheFresh $cachePath)) {
        $shouldFetch = $false
    }

    if ($shouldFetch) {
        try {
            return Fetch-ServerConfig -ApiUrl $ApiUrl -Token $Token -SerialNumber $SerialNumber
        } catch {
            Write-Log "WARN config fetch failed: $($_.Exception.Message)"
            if (Test-Path $cachePath) {
                return Get-Content $cachePath -Raw | ConvertFrom-Json
            }
            throw
        }
    }

    if (Test-Path $cachePath) {
        return Get-Content $cachePath -Raw | ConvertFrom-Json
    }

    return Fetch-ServerConfig -ApiUrl $ApiUrl -Token $Token -SerialNumber $SerialNumber
}

function Apply-SyncConfig {
    param(
        $Response,
        [string]$ApiUrl
    )
    if (-not $Response) { return $null }
    $config = $null
    if ($Response.config) { $config = $Response.config }
    if ($config) {
        $config | ConvertTo-Json -Compress | Set-Content -Path (Get-CachePath) -Encoding UTF8
    }
    return $config
}

function Get-ServerAgentVersionFromResponse {
    param($Response)
    if (-not $Response) { return $null }
    if ($Response.agentScriptVersion) { return [string]$Response.agentScriptVersion }
    if ($Response.config -and $Response.config.agentScriptVersion) {
        return [string]$Response.config.agentScriptVersion
    }
    return $null
}

function Test-NeedsAgentUpdateFromResponse {
    param($Response)
    if (-not $Response) { return $false }
    $localVersion = Get-LocalAgentVersion
    $serverVersion = Get-ServerAgentVersionFromResponse -Response $Response
    if ($serverVersion -and (Compare-AgentVersion $localVersion $serverVersion) -ge 0) {
        # Local scripts are already current; let sync clear any pending force flag.
        return $false
    }
    if ($Response.forceAgentUpdate) { return $true }
    if ($Response.config -and $Response.config.forceAgentUpdate) { return $true }
    if (-not $serverVersion) { return $false }
    # Only auto-update when the server bundle is newer than local scripts.
    return (Compare-AgentVersion $serverVersion $localVersion) -gt 0
}

function Get-SetupScriptPath {
    $paths = @(
        (Join-Path (Get-InstallDir) "setup.ps1"),
        (Join-Path (Get-InstallDir) "update.ps1")
    )
    foreach ($path in $paths) {
        if (Test-Path -LiteralPath $path) { return $path }
    }
    return $null
}

function Invoke-AgentSetupScript {
    param(
        [string]$SetupScript,
        [string]$ApiUrl,
        [string]$Token,
        [switch]$Force
    )
    Unblock-File -LiteralPath $SetupScript -ErrorAction SilentlyContinue
    if ($Force) {
        Set-Content -Path (Join-Path (Get-InstallDir) "force-update.txt") `
            -Value (Get-Date -Format "o") -Encoding UTF8
    }

    if (-not (Get-Command Invoke-AgentScriptBypass -ErrorAction SilentlyContinue)) {
        foreach ($path in @(
            (Join-Path (Get-InstallDir) "lib\agent-download.ps1"),
            (Join-Path (Get-InstallDir) "agent-download.ps1")
        )) {
            if (Test-Path -LiteralPath $path) {
                . $path
                break
            }
        }
    }
    if (Get-Command Invoke-AgentScriptBypass -ErrorAction SilentlyContinue) {
        $bound = @{ ApiUrl = $ApiUrl; Token = $Token; Silent = $true }
        if ($Force) { $bound.Force = $true }
        Invoke-AgentScriptBypass -Ps1Path $SetupScript -BoundVars $bound -Hidden -Wait | Out-Null
        return
    }

    $txtPath = [System.IO.Path]::ChangeExtension($SetupScript, ".txt")
    if (Get-Command Publish-AgentScriptTxt -ErrorAction SilentlyContinue) {
        $txtPath = Publish-AgentScriptTxt -Ps1Path $SetupScript
    } elseif (-not (Test-Path -LiteralPath $txtPath)) {
        Copy-Item $SetupScript $txtPath -Force
        Unblock-File -LiteralPath $txtPath -ErrorAction SilentlyContinue
    }
    $runnerPath = Join-Path (Get-InstallDir) "run-update.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""& { `$Silent = `$true; `$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s }""", 0, True
"@
    Set-Content -Path $runnerPath -Value $vbsContent -Encoding ASCII
    Unblock-File -LiteralPath $runnerPath -ErrorAction SilentlyContinue

    $wscript = (Get-Command wscript.exe).Source
    Start-Process -FilePath $wscript -ArgumentList @("//B", "//Nologo", "`"$runnerPath`"") `
        -WindowStyle Hidden -Wait
}

function Ensure-AgentUpdateScripts {
    param(
        [string]$ApiUrl,
        [string]$Token
    )
    if (Get-SetupScriptPath) { return $true }

    Write-Log "Bootstrap: downloading setup scripts for auto-update"
    try {
        $installDir = Get-InstallDir
        $headers = @{ Authorization = "Bearer $Token" }
        $filesBase = "$($ApiUrl.TrimEnd('/'))/api/agent/files"

        try {
            $cfgUri = "$ApiUrl/api/agent/config"
            if ($serial = Get-LaptopSerial) {
                $cfgUri = "${cfgUri}?serialNumber=$([Uri]::EscapeDataString($serial))"
            }
            $cfg = Invoke-RestMethod -Uri $cfgUri -Headers $headers -TimeoutSec 30
            if ($cfg.agentScriptFilesBase) {
                $filesBase = [string]$cfg.agentScriptFilesBase.TrimEnd("/")
            }
            if ($cfg.vercelProtectionBypass) {
                $headers["x-vercel-protection-bypass"] = [string]$cfg.vercelProtectionBypass
            }
        } catch {
            Write-Log "WARN bootstrap config fetch failed: $($_.Exception.Message)"
        }

        $libDir = Join-Path $installDir "lib"
        New-Item -ItemType Directory -Path $libDir -Force | Out-Null
        foreach ($pair in @(
                @{ url = "$filesBase/agent-download.ps1"; dest = Join-Path $libDir "agent-download.ps1" },
                @{ url = "$filesBase/agent-storage.ps1"; dest = Join-Path $libDir "agent-storage.ps1" },
                @{ url = "$filesBase/setup.ps1"; dest = Join-Path $installDir "setup.ps1" },
                @{ url = "$filesBase/update.ps1"; dest = Join-Path $installDir "update.ps1" }
            )) {
            Invoke-WebRequest -Uri $pair.url -Headers $headers -OutFile $pair.dest `
                -UseBasicParsing -TimeoutSec 120
            Unblock-File -LiteralPath $pair.dest -ErrorAction SilentlyContinue
        }
        return [bool](Get-SetupScriptPath)
    } catch {
        Write-Log "WARN bootstrap download failed: $($_.Exception.Message)"
        return $false
    }
}

function Invoke-AgentSelfUpdate([string]$ApiUrl, [string]$Token, [bool]$Force) {
    if (-not (Ensure-AgentUpdateScripts -ApiUrl $ApiUrl -Token $Token)) {
        Write-Log "WARN setup.ps1 missing; cannot auto-update"
        return $false
    }

    $setupScript = Get-SetupScriptPath
    if (-not $setupScript) {
        Write-Log "WARN setup.ps1 missing after bootstrap; cannot auto-update"
        return $false
    }

    $before = Get-LocalAgentVersion
    try {
        Write-Log "Auto-update: local v$before (force=$Force)"
        Invoke-AgentSetupScript -SetupScript $setupScript -ApiUrl $ApiUrl -Token $Token -Force:$Force
        $after = Get-LocalAgentVersion
        Write-Log "Auto-update finished local v$after"
        # Only exit for a re-run when scripts actually changed; force reinstall alone
        # should not block sync when the version is already current.
        return (Compare-AgentVersion $after $before) -gt 0
    } catch {
        Write-Log "WARN auto-update failed: $($_.Exception.Message)"
        return $false
    }
}

function Test-ShouldRunHourlyUpdateCheck {
    $path = Get-LastUpdateCheckPath
    if (-not (Test-Path $path)) { return $true }
    try {
        $last = [DateTime]::Parse((Get-Content $path -Raw).Trim())
        return ((Get-Date) - $last).TotalMinutes -ge $UpdateCheckIntervalMinutes
    } catch {
        return $true
    }
}

function Set-LastUpdateCheckTime {
    Set-Content -Path (Get-LastUpdateCheckPath) -Value (Get-Date -Format "o") -Encoding UTF8
}

function Invoke-HourlyUpdateCheck([string]$ApiUrl, [string]$Token) {
    $setupScript = Get-SetupScriptPath
    if (-not $setupScript) {
        Write-Log "WARN setup.ps1 missing; cannot run hourly update check"
        return
    }
    try {
        Write-Log "Hourly update check"
        Invoke-AgentSetupScript -SetupScript $setupScript -ApiUrl $ApiUrl -Token $Token
    } catch {
        Write-Log "WARN hourly update check failed: $($_.Exception.Message)"
    }
}

function Remove-AckedEvents {
    param(
        [array]$Queue,
        $AckedIds
    )
    if (-not $AckedIds) { return $Queue }
    $acked = @{}
    foreach ($id in $AckedIds) { $acked[[string]$id] = $true }
    return @($Queue | Where-Object { -not $acked[[string]$_.id] })
}

function Invoke-AgentSync {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$SerialNumber,
        [string]$ScriptVersion,
        [array]$Events,
        $OpenVisit,
        [string]$SyncTrigger
    )

    $body = @{
        token = $Token
        serialNumber = $SerialNumber
        scriptVersion = $ScriptVersion
        apiUrl = $ApiUrl
        events = $Events
    }
    if ($OpenVisit) { $body.openVisit = $OpenVisit }
    if ($SyncTrigger) { $body.syncTrigger = $SyncTrigger }

    $json = $body | ConvertTo-Json -Depth 8 -Compress
    $uri = "$ApiUrl/api/agent/sync"

    try {
        $response = Invoke-RestMethod -Uri $uri -Method POST `
            -ContentType "application/json" -Body $json -TimeoutSec 45
        return @{ ok = $true; response = $response; statusCode = 200 }
    } catch {
        $statusCode = $null
        if ($_.Exception.Response) {
            try { $statusCode = [int]$_.Exception.Response.StatusCode } catch {}
        }
        if ($statusCode -eq 404) {
            return @{ ok = $false; notFound = $true; statusCode = 404; error = $_.Exception.Message }
        }
        throw
    }
}

function Invoke-LegacyHeartbeat {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$SerialNumber,
        [string]$Ssid,
        [string]$ScriptVersion,
        [string]$VpnGateway
    )
    $payload = @{
        token = $Token
        serialNumber = $SerialNumber
        ssid = $Ssid
        at = Get-NowIso
        source = "wifi"
        vpnGateway = $VpnGateway
        scriptVersion = $ScriptVersion
        apiUrl = $ApiUrl
    } | ConvertTo-Json -Compress

    $maxPostAttempts = 3
    $postError = $null
    for ($attempt = 1; $attempt -le $maxPostAttempts; $attempt++) {
        try {
            $response = Invoke-RestMethod -Uri "$ApiUrl/api/heartbeat" -Method POST `
                -ContentType "application/json" -Body $payload -TimeoutSec 30
            Write-Log "OK legacy heartbeat ssid=$Ssid inOffice=$($response.inOffice)"
            return @{ ok = $true; response = $response }
        } catch {
            $postError = $_.Exception.Message
            if ($attempt -lt $maxPostAttempts) {
                Write-Log "WARN legacy POST attempt $attempt failed: $postError; retrying"
                Start-Sleep -Seconds ([Math]::Min(15, 3 * $attempt))
            }
        }
    }
    Write-Log "ERROR legacy POST failed after $maxPostAttempts attempts: $postError"
    return @{ ok = $false; error = $postError }
}

function Get-SyncTrigger {
    param(
        [bool]$IsResumeRun,
        [bool]$SsidChanged,
        [bool]$HoursTargetMetQueued,
        [bool]$ActivityDue,
        [int]$QueuedEventCount
    )
    if ($IsResumeRun) { return "resume_wake" }
    if ($SsidChanged) { return "ssid_change" }
    if ($HoursTargetMetQueued) { return "hours_target_met" }
    if ($ActivityDue) { return "activity_tick" }
    if ($QueuedEventCount -gt 0) { return "queued_events" }
    return "health_ping"
}

function Invoke-FlushSync {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$SerialNumber,
        [string]$ScriptVersion,
        $SyncState,
        [bool]$AllowHealthPing,
        [string]$FallbackSsid,
        [string]$VpnGateway,
        [string]$SyncTrigger
    )

    $queue = @(Get-EventQueue)
    $eventsToSend = @()
    foreach ($evt in $queue) { $eventsToSend += $evt }

    if ($eventsToSend.Count -eq 0 -and $AllowHealthPing) {
        $eventsToSend += @{
            id = New-EventId
            type = "health_ping"
            at = Get-NowIso
        }
    }

    if ($eventsToSend.Count -eq 0) {
        return @{ synced = $false; syncState = $SyncState }
    }

    $openVisit = Get-OpenVisitFromState $SyncState
    $syncResult = Invoke-AgentSync -ApiUrl $ApiUrl -Token $Token -SerialNumber $SerialNumber `
        -ScriptVersion $ScriptVersion -Events $eventsToSend -OpenVisit $openVisit `
        -SyncTrigger $SyncTrigger

    if ($syncResult.notFound) {
        Write-Log "WARN sync 404; falling back to legacy heartbeat"
        $legacy = Invoke-LegacyHeartbeat -ApiUrl $ApiUrl -Token $Token -SerialNumber $SerialNumber `
            -Ssid $FallbackSsid -ScriptVersion $ScriptVersion -VpnGateway $VpnGateway
        if ($legacy.ok) {
            $remaining = Remove-AckedEvents -Queue (Get-EventQueue) -AckedIds ($eventsToSend | ForEach-Object { $_.id })
            Set-EventQueue $remaining
            $SyncState.lastSyncAt = Get-NowIso
            return @{ synced = $true; syncState = $SyncState; legacy = $true }
        }
        return @{ synced = $false; syncState = $SyncState; error = $legacy.error }
    }

    if (-not $syncResult.ok) {
        return @{ synced = $false; syncState = $SyncState; error = $syncResult.error }
    }

    $response = $syncResult.response
    $remaining = Remove-AckedEvents -Queue $queue -AckedIds $response.ackedEventIds
    Set-EventQueue $remaining
    $SyncState.lastSyncAt = Get-NowIso

    $serverConfig = Apply-SyncConfig -Response $response -ApiUrl $ApiUrl
    $selfUpdated = $false
    if (Test-NeedsAgentUpdateFromResponse -Response $response) {
        $force = [bool]$response.forceAgentUpdate
        if ($response.config -and $response.config.forceAgentUpdate) { $force = $true }
        $selfUpdated = Invoke-AgentSelfUpdate -ApiUrl $ApiUrl -Token $Token -Force $force
        Set-LastUpdateCheckTime
    }

    $eventTypes = ($eventsToSend | ForEach-Object { $_.type }) -join ","
    Write-Log "OK sync events=$eventTypes acked=$($response.ackedEventIds.Count) remaining=$($remaining.Count)"
    return @{
        synced = $true
        syncState = $SyncState
        response = $response
        serverConfig = $serverConfig
        selfUpdated = $selfUpdated
    }
}

if (-not (Get-Command Invoke-AgentStorageMaintenance -ErrorAction SilentlyContinue)) {
    foreach ($modulePath in @(
        (Join-Path (Get-InstallDir) "lib\agent-storage.ps1"),
        (Join-Path (Get-InstallDir) "agent-storage.ps1")
    )) {
        if (Test-Path -LiteralPath $modulePath) {
            . $modulePath
            break
        }
    }
}

Invoke-LocalStorageMaintenance

$configPath = Get-ConfigPath
if (-not (Test-Path $configPath)) {
    Write-Log "ERROR: Config not found. Run install.ps1 first."
    if ($DryRun) { Write-Host "ERROR: Config not found. Run install.ps1 first."; exit 1 }
    exit 1
}

$resumeGapMin = $null
$isResumeRun = Test-ResumeFromSleep
if ($isResumeRun) {
    $last = Get-LastRunTime
    $resumeGapMin = [Math]::Round(((Get-Date) - $last).TotalMinutes, 1)
    Write-Log "RESUME detected (gap ${resumeGapMin}m since last run)"
}
Set-LastRunTime

$localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
$apiUrl = $localConfig.apiUrl.TrimEnd("/")
$token = $localConfig.token

$serialNumber = Get-LaptopSerial
if (-not $serialNumber -and $localConfig.serialNumber) {
    $serialNumber = $localConfig.serialNumber
}

$networkWaitSec = if ($isResumeRun) { 90 } else { 60 }
Wait-NetworkReady -ApiUrl $apiUrl -MaxWaitSec $networkWaitSec | Out-Null

$cachedServerConfig = $null
$cachePath = Get-CachePath
if (Test-Path $cachePath) {
    try { $cachedServerConfig = Get-Content $cachePath -Raw | ConvertFrom-Json } catch {}
}

$hourlyUpdateCheck = Test-ShouldRunHourlyUpdateCheck
$forceConfigFetch = $isResumeRun -or $hourlyUpdateCheck

try {
    $serverConfig = Get-ServerConfig -ApiUrl $apiUrl -Token $token -SerialNumber $serialNumber `
        -Force:$forceConfigFetch
} catch {
    Write-Log "ERROR: Cannot fetch server config"
    if ($DryRun) { Write-Host "ERROR: Cannot fetch server config: $($_.Exception.Message)"; exit 1 }
    exit 1
}

if (Test-NeedsAgentUpdateFromResponse -Response $serverConfig) {
    $forceUpdate = [bool]$serverConfig.forceAgentUpdate
    if ($serverConfig.config -and $serverConfig.config.forceAgentUpdate) { $forceUpdate = $true }
    if (Invoke-AgentSelfUpdate -ApiUrl $apiUrl -Token $token -Force $forceUpdate) {
        Set-LastUpdateCheckTime
        Write-Log "EXIT after self-update; next run uses refreshed scripts"
        exit 0
    }
    Set-LastUpdateCheckTime
} elseif ($hourlyUpdateCheck) {
    Invoke-HourlyUpdateCheck -ApiUrl $apiUrl -Token $token
    Set-LastUpdateCheckTime
}

Set-RunCounter ((Get-RunCounter) + 1)

$heartbeatInterval = Get-HeartbeatIntervalMinutes $serverConfig
$timezone = Get-AgentTimezone $serverConfig
$dayKey = Get-DayKey $timezone
$scriptVersion = Get-LocalAgentVersion

$ssidResult = Get-CurrentWifiSsidWithRetry
$ssid = $ssidResult.Ssid
$ssidMethod = $ssidResult.Method
$vpnGateway = Get-VpnGatewayDiagnostic

$presence = Get-PresenceState
$previousSsid = $presence.ssid
$syncState = Get-SyncState
$previousDayKey = if ($syncState.dayKey) { [string]$syncState.dayKey } else { $null }
$syncState = Maybe-EnqueueDailySummary -SyncState $syncState -DayKey $dayKey
$dayRolledOver = $previousDayKey -and $previousDayKey -ne $dayKey
if ($dayRolledOver) {
    $isOfficeNow = Test-IsOfficeSsid -Ssid $ssid -ServerConfig $serverConfig
    $hasOpenVisit = [bool](Get-OpenVisitFromState $syncState)
    if ($isOfficeNow -and -not $hasOpenVisit) {
        $syncState = Start-LocalVisit -SyncState $syncState -Ssid $ssid
        Write-Log "NEW_DAY visit_start on office Wi-Fi"
    }
}

$ssidChanged = ($previousSsid -ne $ssid)
$pendingEvents = @()

if ($ssidChanged) {
    $alreadyQueued = $syncState.pendingSsid -and [string]$syncState.pendingSsid -eq $ssid
    if (-not $alreadyQueued) {
        $fromSsid = if ($syncState.pendingPreviousSsid) { [string]$syncState.pendingPreviousSsid } else { $previousSsid }
        # One timestamp for the whole office Wi-Fi disconnect transition. If the laptop slept on
        # office Wi-Fi without disconnecting, checkout time is when we detect the SSID change
        # (often on wake at home Wi-Fi the next morning).
        $transitionAt = Get-NowIso
        Add-WifiChangeEvents -PreviousSsid $fromSsid -CurrentSsid $ssid -At $transitionAt
        $syncState = Update-VisitBoundaries -SyncState $syncState -PreviousSsid $fromSsid `
            -CurrentSsid $ssid -ServerConfig $serverConfig -TransitionAt $transitionAt
        if (Test-IsOfficeSsid -Ssid $ssid -ServerConfig $serverConfig) {
            $syncState = Maybe-EnqueueHoursTargetMet -SyncState $syncState -DayKey $dayKey `
                -ServerConfig $serverConfig
        }
        $syncState.pendingSsid = $ssid
        $syncState.pendingPreviousSsid = $fromSsid
    }
    $pendingEvents = @(Get-EventQueue)
}

$activityTickQueued = $false
$activityDue = Test-ActivityTickDue -SyncState $syncState -IntervalMinutes $heartbeatInterval
if ($isResumeRun) {
    Add-QueuedEvent -Type "session_resume" -Fields @{
        gapMinutes = $resumeGapMin
        ssid = $ssid
    }
}
if ($isResumeRun -or $activityDue) {
    $syncState = Sync-UptimeForActivityRun -SyncState $syncState -IsResumeRun:($isResumeRun)
    $tickFields = @{ ssid = $ssid }
    $uptimeFields = Get-UptimeEventFields -SyncState $syncState
    foreach ($key in $uptimeFields.Keys) {
        $tickFields[$key] = $uptimeFields[$key]
    }
    Add-QueuedEvent -Type "activity_tick" -Fields $tickFields
    $activityTickQueued = $true
    $pendingEvents = @(Get-EventQueue)
}

if (Test-IsOfficeSsid -Ssid $ssid -ServerConfig $serverConfig) {
    $syncState = Maybe-EnqueueHoursTargetMet -SyncState $syncState -DayKey $dayKey `
        -ServerConfig $serverConfig
}

if ($DryRun) {
    Write-Host "=== Heartbeat dry run (event mode) ==="
    Write-Host "Local config:  $configPath"
    Write-Host "API URL:       $apiUrl"
    Write-Host "Laptop serial: $(if ($serialNumber) { $serialNumber } else { '(unable to read)' })"
    Write-Host "SSID detected: $(if ($ssid) { $ssid } else { '(none)' }) via $ssidMethod"
    Write-Host "Previous SSID: $(if ($previousSsid) { $previousSsid } else { '(none)' })"
    Write-Host "SSID changed:  $ssidChanged"
    Write-Host "VPN (diag):    $(if ($vpnGateway) { $vpnGateway } else { '(not connected)' })"
    Write-Host ""
    Write-Host "Server config:"
    Write-Host "  SSIDs:       $($serverConfig.ssids -join ', ')"
    Write-Host "  Hours target: $($serverConfig.hoursTarget)"
    Write-Host "  Timezone:    $timezone"
    Write-Host "  Heartbeat interval: ${heartbeatInterval}m"
    Write-Host "  Agent version (server): $($serverConfig.agentScriptVersion)"
    Write-Host "  Agent version (local):  $scriptVersion"
    Write-Host ""
    Write-Host "Queued events: $(Get-EventQueue | ConvertTo-Json -Compress)"
    Write-Host "Open visit:    $(if ($syncState.openVisit) { ($syncState.openVisit | ConvertTo-Json -Compress) } else { '(none)' })"
    exit 0
}

$shouldSync = $isResumeRun -or $ssidChanged -or $activityDue -or (@(Get-EventQueue).Count -gt 0)
if ($shouldSync) {
    $hoursTargetMetQueued = @((Get-EventQueue) | Where-Object { $_.type -eq "hours_target_met" }).Count -gt 0
    $syncTrigger = Get-SyncTrigger -IsResumeRun $isResumeRun -SsidChanged $ssidChanged `
        -HoursTargetMetQueued $hoursTargetMetQueued -ActivityDue $activityDue `
        -QueuedEventCount (@(Get-EventQueue).Count)
    $flush = Invoke-FlushSync -ApiUrl $apiUrl -Token $token -SerialNumber $serialNumber `
        -ScriptVersion $scriptVersion -SyncState $syncState -AllowHealthPing:(-not $ssidChanged) `
        -FallbackSsid $ssid -VpnGateway $vpnGateway -SyncTrigger $syncTrigger
    $syncState = $flush.syncState
    if (-not $flush.synced) {
        if ($flush.error) { Write-Log "ERROR sync failed: $($flush.error)"; exit 1 }
    } else {
        if ($flush.selfUpdated) {
            Set-SyncState $syncState
            Write-Log "EXIT after sync self-update; next run uses refreshed scripts"
            exit 0
        }
        if ($activityTickQueued) {
            $syncState.lastActivityTickAt = Get-NowIso
        }
        if ($ssidChanged) {
            Set-PresenceState -Ssid $ssid
            $syncState.pendingSsid = $null
            $syncState.pendingPreviousSsid = $null
        }
    }
} else {
    Write-Log "SKIP no events to sync"
}

Set-SyncState $syncState
exit 0
