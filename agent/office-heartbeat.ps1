# Office Tracker heartbeat agent
# Reads Wi-Fi SSID locally, fetches ALL config from server, POSTs heartbeat.
# Server decides inOffice. Nothing hardcoded on the laptop.
# GlobalProtect/VPN is diagnostic only and never counts toward hours.

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ConfigFetchIntervalRuns = 5
$UpdateCheckIntervalMinutes = 60

# Version of this script. Keep in sync with agent/version.txt. Used when version.txt is
# missing so the server always receives a real version instead of nothing.
$AgentScriptVersion = "1.2.11"

function Write-Log([string]$Message) {
    $logDir = Join-Path $env:LOCALAPPDATA "OfficeTracker\logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = Join-Path $logDir "heartbeat.log"
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
}

function Get-VersionPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\version.txt"
}

function Get-LocalAgentVersion {
    $path = Get-VersionPath
    if (Test-Path $path) {
        $fromFile = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if ($fromFile) {
            $trimmed = $fromFile.Trim()
            # Server rejects anything that is not numeric dotted form, so check before sending.
            if ($trimmed -match '^\d+(\.\d+){0,3}$') { return $trimmed }
        }
    }
    return $AgentScriptVersion
}

Write-Log "START v$(Get-LocalAgentVersion)"

function Get-ConfigPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"
}

function Get-CachePath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\server-config.json"
}

function Get-RunCounterPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\run-counter.txt"
}

function Get-LastRunPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\last-run.txt"
}

function Get-LastSuccessfulHeartbeatPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\last-successful-heartbeat.txt"
}

function Get-LastRunTime {
    $path = Get-LastRunPath
    if (-not (Test-Path $path)) { return $null }
    try {
        return [DateTime]::Parse((Get-Content $path -Raw).Trim())
    } catch {
        return $null
    }
}

function Set-LastRunTime {
    Set-Content -Path (Get-LastRunPath) -Value (Get-Date -Format "o") -Encoding UTF8
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

function Test-HeartbeatDue([int]$IntervalMinutes) {
    $path = Get-LastSuccessfulHeartbeatPath
    if (-not (Test-Path $path)) { return $true }
    try {
        $lastSuccess = [DateTime]::Parse((Get-Content $path -Raw).Trim())
        return ((Get-Date) - $lastSuccess).TotalMinutes -ge $IntervalMinutes
    } catch {
        return $true
    }
}

function Set-LastSuccessfulHeartbeatTime {
    Set-Content -Path (Get-LastSuccessfulHeartbeatPath) -Value (Get-Date -Format "o") -Encoding UTF8
}

function Test-ResumeFromSleep {
    $last = Get-LastRunTime
    if (-not $last) { return $false }
    return ((Get-Date) - $last).TotalMinutes -gt 5
}

function Compare-AgentVersion {
    param([string]$Left, [string]$Right)
    $parse = {
        param([string]$v)
        $v.Trim().Split(".") | ForEach-Object { [int]($_ -replace '\D', '0') }
    }
    $lv = & $parse $Left
    $rv = & $parse $Right
    $len = [Math]::Max($lv.Count, $rv.Count)
    for ($i = 0; $i -lt $len; $i++) {
        $l = if ($i -lt $lv.Count) { $lv[$i] } else { 0 }
        $r = if ($i -lt $rv.Count) { $rv[$i] } else { 0 }
        if ($l -gt $r) { return 1 }
        if ($l -lt $r) { return -1 }
    }
    return 0
}

function Test-NeedsAgentUpdate($ServerConfig) {
    if ($ServerConfig.forceAgentUpdate) { return $true }
    if (-not $ServerConfig.agentScriptVersion) { return $false }
    $local = Get-LocalAgentVersion
    return (Compare-AgentVersion $ServerConfig.agentScriptVersion $local) -ne 0
}

function Invoke-AgentSelfUpdate([string]$ApiUrl, [string]$Token, [bool]$Force) {
    $updateScript = Join-Path $env:LOCALAPPDATA "OfficeTracker\update.ps1"
    if (-not (Test-Path $updateScript)) {
        Write-Log "WARN update.ps1 missing; cannot auto-update"
        return
    }
    try {
        Write-Log "Auto-update: installed agent differs from server version"
        Invoke-AgentUpdateScript -UpdateScript $updateScript -ApiUrl $ApiUrl -Token $Token -Force:$Force
    } catch {
        Write-Log "WARN auto-update failed: $($_.Exception.Message)"
    }
}

function Get-LastUpdateCheckPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\last-update-check.txt"
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

function Invoke-AgentUpdateScript {
    param(
        [string]$UpdateScript,
        [string]$ApiUrl,
        [string]$Token,
        [switch]$Force
    )
    # ExecutionPolicy Bypass does not suppress Attachment Manager prompts. Remove MOTW
    # from the installed updater, then launch that exact copy through a hidden VBS host.
    Unblock-File -LiteralPath $UpdateScript -ErrorAction SilentlyContinue
    if ($Force) {
        Set-Content -Path (Join-Path (Split-Path $UpdateScript) "force-update.txt") `
            -Value (Get-Date -Format "o") -Encoding UTF8
    }

    $runnerPath = Join-Path (Split-Path $UpdateScript) "run-update.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$UpdateScript"" -Silent", 0, True
"@
    Set-Content -Path $runnerPath -Value $vbsContent -Encoding ASCII
    Unblock-File -LiteralPath $runnerPath -ErrorAction SilentlyContinue

    $wscript = (Get-Command wscript.exe).Source
    Start-Process -FilePath $wscript -ArgumentList @("//B", "//Nologo", "`"$runnerPath`"") `
        -WindowStyle Hidden -Wait
}

function Invoke-HourlyUpdateCheck([string]$ApiUrl, [string]$Token) {
    $updateScript = Join-Path $env:LOCALAPPDATA "OfficeTracker\update.ps1"
    if (-not (Test-Path $updateScript)) {
        Write-Log "WARN update.ps1 missing; cannot run hourly update check"
        return
    }
    try {
        Write-Log "Hourly update check"
        Invoke-AgentUpdateScript -UpdateScript $updateScript -ApiUrl $ApiUrl -Token $Token
    } catch {
        Write-Log "WARN hourly update check failed: $($_.Exception.Message)"
    }
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
    # Method 1: netsh wlan (actual WLAN SSID; prefer over connection profile name)
    $netshSsid = Get-WifiSsidFromNetsh
    if ($netshSsid) {
        $normalized = Normalize-WifiSsid $netshSsid
        if ($normalized) { return @{ Ssid = $normalized; Method = "netsh" } }
    }

    # Method 2: Get-NetConnectionProfile (fallback; may show captive portal domain, not WLAN SSID)
    try {
        $profile = Get-NetConnectionProfile -ErrorAction Stop |
            Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*' } |
            Select-Object -First 1
        if ($profile -and $profile.Name) {
            $normalized = Normalize-WifiSsid $profile.Name
            if ($normalized) { return @{ Ssid = $normalized; Method = "NetConnectionProfile" } }
        }
    } catch {}

    # Method 3: WMI MSNdis (fallback, often blocked)
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
        if (-not $gp) { return $null }
        return "GlobalProtect-Connected"
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

function Fetch-ServerConfig([string]$ApiUrl, [string]$Token, [string]$SerialNumber) {
    $headers = @{ Authorization = "Bearer $Token" }
    $uri = "$ApiUrl/api/agent/config"
    if ($SerialNumber) {
        $encoded = [Uri]::EscapeDataString($SerialNumber)
        $uri = "${uri}?serialNumber=$encoded"
    }
    $response = Invoke-RestMethod -Uri $uri -Method GET `
        -Headers $headers -TimeoutSec 30
    $cachePath = Get-CachePath
    $response | ConvertTo-Json -Compress | Set-Content -Path $cachePath -Encoding UTF8
    return $response
}

function Get-ServerConfig([string]$ApiUrl, [string]$Token, [string]$SerialNumber, [switch]$Force) {
    $cachePath = Get-CachePath
    $counter = Get-RunCounter
    $shouldFetch = $Force -or $counter -eq 0 -or ($counter % $ConfigFetchIntervalRuns -eq 0)

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

$configPath = Get-ConfigPath
if (-not (Test-Path $configPath)) {
    Write-Log "ERROR: Config not found. Run install.ps1 first."
    if ($DryRun) { Write-Host "ERROR: Config not found. Run install.ps1 first."; exit 1 }
    exit 1
}

$isResumeRun = Test-ResumeFromSleep
if ($isResumeRun) {
    $last = Get-LastRunTime
    $gapMin = [Math]::Round(((Get-Date) - $last).TotalMinutes, 1)
    Write-Log "RESUME detected (gap ${gapMin}m since last run)"
}
Set-LastRunTime

$localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
$apiUrl = $localConfig.apiUrl.TrimEnd("/")
$token = $localConfig.token

$cachedServerConfig = $null
$cachePath = Get-CachePath
if (Test-Path $cachePath) {
    try {
        $cachedServerConfig = Get-Content $cachePath -Raw | ConvertFrom-Json
    } catch {}
}
$cachedHeartbeatInterval = Get-HeartbeatIntervalMinutes $cachedServerConfig
if (-not $DryRun -and -not (Test-HeartbeatDue $cachedHeartbeatInterval)) {
    Write-Log "SKIP heartbeat interval ${cachedHeartbeatInterval}m has not elapsed"
    exit 0
}

$serialNumber = Get-LaptopSerial
if (-not $serialNumber -and $localConfig.serialNumber) {
    $serialNumber = $localConfig.serialNumber
}

$networkWaitSec = if ($isResumeRun) { 90 } else { 60 }
Wait-NetworkReady -ApiUrl $apiUrl -MaxWaitSec $networkWaitSec | Out-Null

$hourlyUpdateCheck = Test-ShouldRunHourlyUpdateCheck

try {
    $serverConfig = Get-ServerConfig -ApiUrl $apiUrl -Token $token -SerialNumber $serialNumber -Force
} catch {
    Write-Log "ERROR: Cannot fetch server config"
    if ($DryRun) { Write-Host "ERROR: Cannot fetch server config: $($_.Exception.Message)"; exit 1 }
    exit 1
}

if (Test-NeedsAgentUpdate $serverConfig) {
    Invoke-AgentSelfUpdate -ApiUrl $apiUrl -Token $token -Force ([bool]$serverConfig.forceAgentUpdate)
    Set-LastUpdateCheckTime
} elseif ($hourlyUpdateCheck) {
    Invoke-HourlyUpdateCheck -ApiUrl $apiUrl -Token $token
    Set-LastUpdateCheckTime
}

Set-RunCounter ((Get-RunCounter) + 1)

$heartbeatInterval = Get-HeartbeatIntervalMinutes $serverConfig
if (-not $DryRun -and -not (Test-HeartbeatDue $heartbeatInterval)) {
    Write-Log "SKIP server heartbeat interval ${heartbeatInterval}m has not elapsed"
    exit 0
}

$ssidResult = Get-CurrentWifiSsidWithRetry
$ssid = $ssidResult.Ssid
$ssidMethod = $ssidResult.Method
$vpnGateway = Get-VpnGatewayDiagnostic
$recordedAt = (Get-Date).ToUniversalTime().ToString("o")
$scriptVersion = Get-LocalAgentVersion

$payload = @{
    token          = $token
    serialNumber   = $serialNumber
    ssid           = $ssid
    at             = $recordedAt
    source         = "wifi"
    vpnGateway     = $vpnGateway
    scriptVersion  = $scriptVersion
    apiUrl         = $apiUrl
} | ConvertTo-Json -Compress

if ($DryRun) {
    Write-Host "=== Heartbeat dry run ==="
    Write-Host "Local config:  $configPath (apiUrl + token only)"
    Write-Host "API URL:       $apiUrl"
    Write-Host "Laptop serial: $(if ($serialNumber) { $serialNumber } else { '(unable to read)' })"
    Write-Host "SSID detected: $(if ($ssid) { $ssid } else { '(none)' }) via $ssidMethod"
    if (-not $ssid -and $ssidMethod -eq "none") {
        Write-Host ""
        Write-Host "WLAN SSID unavailable (Identifying... or Wi-Fi still connecting)."
        Write-Host "Agent prefers netsh WLAN SSID, then Get-NetConnectionProfile."
        Write-Host "Use dashboard Check in if SSID is still missing."
    }
    Write-Host "VPN (diag):    $(if ($vpnGateway) { $vpnGateway } else { '(not connected)' })"
    Write-Host ""
    Write-Host "Server config (from $apiUrl/api/agent/config):"
    Write-Host "  SSIDs:       $($serverConfig.ssids -join ', ')"
    Write-Host "  Hours target: $($serverConfig.hoursTarget)"
    Write-Host "  Timezone:    $($serverConfig.timezone)"
    Write-Host "  API version: $($serverConfig.apiVersion)"
    Write-Host "  Heartbeat interval: ${heartbeatInterval}m"
    Write-Host "  Agent version (server): $($serverConfig.agentScriptVersion)"
    Write-Host "  Agent version (local):  $(Get-LocalAgentVersion)"
    Write-Host ""
    Write-Host "Would POST heartbeat (server decides inOffice): $payload"
    exit 0
}

$maxPostAttempts = 3
$postError = $null
for ($attempt = 1; $attempt -le $maxPostAttempts; $attempt++) {
    try {
        $response = Invoke-RestMethod -Uri "$apiUrl/api/heartbeat" -Method POST `
            -ContentType "application/json" -Body $payload -TimeoutSec 30
        Set-LastSuccessfulHeartbeatTime
        Write-Log "OK ssid=$ssid method=$ssidMethod serial=$serialNumber inOffice=$($response.inOffice)"
        exit 0
    } catch {
        $postError = $_.Exception.Message
        if ($attempt -lt $maxPostAttempts) {
            Write-Log "WARN POST attempt $attempt failed: $postError; retrying"
            Start-Sleep -Seconds ([Math]::Min(15, 3 * $attempt))
        }
    }
}
Write-Log "ERROR POST failed after $maxPostAttempts attempts: $postError"
exit 1
