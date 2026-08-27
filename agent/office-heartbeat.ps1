# Office Tracker heartbeat agent
# Reads Wi-Fi SSID locally, fetches ALL config from server, POSTs heartbeat.
# Server decides inOffice. Nothing hardcoded on the laptop.
# GlobalProtect/VPN is diagnostic only and never counts toward hours.

param(
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ConfigFetchIntervalRuns = 5

function Get-ConfigPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\config.json"
}

function Get-CachePath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\server-config.json"
}

function Get-RunCounterPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\run-counter.txt"
}

function Get-VersionPath {
    Join-Path $env:LOCALAPPDATA "OfficeTracker\version.txt"
}

function Get-LocalAgentVersion {
    $path = Get-VersionPath
    if (-not (Test-Path $path)) { return "0.0.0" }
    return (Get-Content $path -Raw -ErrorAction SilentlyContinue).Trim()
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
    if (-not $ServerConfig.agentScriptVersion) { return $false }
    $local = Get-LocalAgentVersion
    return (Compare-AgentVersion $ServerConfig.agentScriptVersion $local) -gt 0
}

function Invoke-AgentSelfUpdate([string]$ApiUrl, [string]$Token) {
    $updateScript = Join-Path $env:LOCALAPPDATA "OfficeTracker\update.ps1"
    if (-not (Test-Path $updateScript)) {
        Write-Log "WARN update.ps1 missing; cannot auto-update"
        return
    }
    try {
        Write-Log "Auto-update: server has newer agent version"
        & $updateScript -ApiUrl $ApiUrl -Token $Token -Silent
    } catch {
        Write-Log "WARN auto-update failed: $($_.Exception.Message)"
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

function Get-CurrentWifiSsid {
    # Method 1: netsh (needs Location services; often blocked on corp laptops)
    try {
        $output = netsh wlan show interfaces 2>$null
        if ($output) {
            foreach ($line in $output) {
                if ($line -match '^\s*SSID\s*:\s*(.+)$' -and $line -notmatch 'BSSID') {
                    $ssid = $Matches[1].Trim()
                    if ($ssid) { return @{ Ssid = $ssid; Method = "netsh" } }
                }
            }
        }
    } catch {}

    # Method 2: Get-NetConnectionProfile (works WITHOUT Location on many corp laptops)
    try {
        $profile = Get-NetConnectionProfile -ErrorAction Stop |
            Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' -or $_.InterfaceAlias -like '*Wireless*' } |
            Select-Object -First 1
        if ($profile -and $profile.Name) {
            $ssid = $profile.Name.Trim() -replace '\s+\d+$', ''
            if ($ssid) { return @{ Ssid = $ssid; Method = "NetConnectionProfile" } }
        }
    } catch {}

    # Method 3: WMI MSNdis (fallback, often blocked)
    try {
        $wmi = Get-CimInstance -Namespace root/wmi -ClassName MSNdis_80211_ServiceSetIdentifier -ErrorAction Stop |
            Select-Object -First 1
        if ($wmi -and $wmi.Ndis80211Ssid.Ssid) {
            $ssid = -join ($wmi.Ndis80211Ssid.Ssid | ForEach-Object {
                if ($_ -ge 32 -and $_ -le 126) { [char]$_ }
            })
            $ssid = $ssid.Trim() -replace '\s+\d+$', ''
            if ($ssid) { return @{ Ssid = $ssid; Method = "WMI" } }
        }
    } catch {}

    # Method 4: netsh piped to Select-String (last resort)
    try {
        $match = netsh wlan show interfaces 2>$null | Select-String -Pattern '^\s*SSID\s*:\s*(.+)$' |
            Where-Object { $_.Line -notmatch 'BSSID' } | Select-Object -First 1
        if ($match -and $match.Matches[0].Groups[1].Value) {
            $ssid = $match.Matches[0].Groups[1].Value.Trim()
            if ($ssid) { return @{ Ssid = $ssid; Method = "netsh-SelectString" } }
        }
    } catch {}

    return @{ Ssid = $null; Method = "none" }
}

function Get-VpnGatewayDiagnostic {
    try {
        $gp = Get-Process -Name "PanGPA","GlobalProtect" -ErrorAction SilentlyContinue
        if (-not $gp) { return $null }
        return "GlobalProtect-Connected"
    } catch {}
    return $null
}

function Write-Log([string]$Message) {
    $logDir = Join-Path $env:LOCALAPPDATA "OfficeTracker\logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $logFile = Join-Path $logDir "heartbeat.log"
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path $logFile -Value $line -ErrorAction SilentlyContinue
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

function Fetch-ServerConfig([string]$ApiUrl, [string]$Token) {
    $headers = @{ Authorization = "Bearer $Token" }
    $response = Invoke-RestMethod -Uri "$ApiUrl/api/agent/config" -Method GET `
        -Headers $headers -TimeoutSec 30
    $cachePath = Get-CachePath
    $response | ConvertTo-Json -Compress | Set-Content -Path $cachePath -Encoding UTF8
    return $response
}

function Get-ServerConfig([string]$ApiUrl, [string]$Token, [switch]$Force) {
    $cachePath = Get-CachePath
    $counter = Get-RunCounter
    $shouldFetch = $Force -or $counter -eq 0 -or ($counter % $ConfigFetchIntervalRuns -eq 0)

    if ($shouldFetch) {
        try {
            return Fetch-ServerConfig -ApiUrl $ApiUrl -Token $Token
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

    return Fetch-ServerConfig -ApiUrl $ApiUrl -Token $Token
}

$configPath = Get-ConfigPath
if (-not (Test-Path $configPath)) {
    Write-Log "ERROR: Config not found. Run install.ps1 first."
    if ($DryRun) { Write-Host "ERROR: Config not found. Run install.ps1 first."; exit 1 }
    exit 1
}

$localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
$apiUrl = $localConfig.apiUrl.TrimEnd("/")
$token = $localConfig.token

try {
    $serverConfig = Get-ServerConfig -ApiUrl $apiUrl -Token $token
} catch {
    Write-Log "ERROR: Cannot fetch server config"
    if ($DryRun) { Write-Host "ERROR: Cannot fetch server config: $($_.Exception.Message)"; exit 1 }
    exit 1
}

if (Test-NeedsAgentUpdate $serverConfig) {
    Invoke-AgentSelfUpdate -ApiUrl $apiUrl -Token $token
}

Set-RunCounter ((Get-RunCounter) + 1)

$ssidResult = Get-CurrentWifiSsid
$ssid = $ssidResult.Ssid
$ssidMethod = $ssidResult.Method
$serialNumber = Get-LaptopSerial
if (-not $serialNumber -and $localConfig.serialNumber) {
    $serialNumber = $localConfig.serialNumber
}
$vpnGateway = Get-VpnGatewayDiagnostic
$recordedAt = (Get-Date).ToUniversalTime().ToString("o")

$payload = @{
    token        = $token
    serialNumber = $serialNumber
    ssid         = $ssid
    at           = $recordedAt
    source       = "wifi"
    vpnGateway   = $vpnGateway
} | ConvertTo-Json -Compress

if ($DryRun) {
    Write-Host "=== Heartbeat dry run ==="
    Write-Host "Local config:  $configPath (apiUrl + token only)"
    Write-Host "API URL:       $apiUrl"
    Write-Host "Laptop serial: $(if ($serialNumber) { $serialNumber } else { '(unable to read)' })"
    Write-Host "SSID detected: $(if ($ssid) { $ssid } else { '(none)' }) via $ssidMethod"
    if (-not $ssid -and $ssidMethod -eq "none") {
        Write-Host ""
        Write-Host "Location may be blocked on corp laptops."
        Write-Host "Agent also tries Get-NetConnectionProfile."
        Write-Host "Use dashboard Check in if SSID is still missing."
    }
    Write-Host "VPN (diag):    $(if ($vpnGateway) { $vpnGateway } else { '(not connected)' })"
    Write-Host ""
    Write-Host "Server config (from $apiUrl/api/agent/config):"
    Write-Host "  SSIDs:       $($serverConfig.ssids -join ', ')"
    Write-Host "  Hours target: $($serverConfig.hoursTarget)"
    Write-Host "  Timezone:    $($serverConfig.timezone)"
    Write-Host "  API version: $($serverConfig.apiVersion)"
    Write-Host "  Agent version (server): $($serverConfig.agentScriptVersion)"
    Write-Host "  Agent version (local):  $(Get-LocalAgentVersion)"
    Write-Host ""
    Write-Host "Would POST heartbeat (server decides inOffice): $payload"
    exit 0
}

try {
    $response = Invoke-RestMethod -Uri "$apiUrl/api/heartbeat" -Method POST `
        -ContentType "application/json" -Body $payload -TimeoutSec 30
    Write-Log "OK ssid=$ssid method=$ssidMethod serial=$serialNumber inOffice=$($response.inOffice)"
} catch {
    Write-Log "ERROR POST failed: $($_.Exception.Message)"
    exit 1
}
