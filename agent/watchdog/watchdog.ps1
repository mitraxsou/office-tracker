# My Office Pulse independent hourly watchdog.
# Isolated from the main heartbeat runner (no IEX of that script).
# Reads local config, GETs the fleet-stable target, and repairs the agent if behind.
# Routine agent updates never replace this file.
# ASCII-only (BUG-017). Rarely changed; installed under %LOCALAPPDATA%\OfficeTracker\watchdog\

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$InstallDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
$WatchdogDir = Join-Path $InstallDir "watchdog"
$LogDir = Join-Path $InstallDir "logs"
$LogPath = Join-Path $LogDir "watchdog.log"
$ConfigPath = Join-Path $InstallDir "config.json"
$VersionPath = Join-Path $InstallDir "version.txt"

function Write-WatchdogLog([string]$Message) {
    if (-not (Test-Path -LiteralPath $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Compare-AgentVersion([string]$A, [string]$B) {
    $parse = {
        param([string]$V)
        if (-not $V) { return @(0) }
        return @($V.Trim().Split('.') | ForEach-Object {
            $n = 0
            [void][int]::TryParse($_, [ref]$n)
            $n
        })
    }
    $av = & $parse $A
    $bv = & $parse $B
    $len = [Math]::Max($av.Count, $bv.Count)
    for ($i = 0; $i -lt $len; $i++) {
        $ai = if ($i -lt $av.Count) { $av[$i] } else { 0 }
        $bi = if ($i -lt $bv.Count) { $bv[$i] } else { 0 }
        if ($ai -gt $bi) { return 1 }
        if ($ai -lt $bi) { return -1 }
    }
    return 0
}

function Get-LocalVersion {
    if (-not (Test-Path -LiteralPath $VersionPath)) { return "0.0.0" }
    try {
        $raw = (Get-Content -LiteralPath $VersionPath -Raw -Encoding UTF8).Trim()
        if ($raw -match '^\d+(\.\d+){0,3}$') { return $raw }
    } catch {}
    return "0.0.0"
}

function Get-AgentConfig {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        throw "config.json missing at $ConfigPath"
    }
    $cfg = Get-Content -LiteralPath $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $apiUrl = [string]$cfg.apiUrl
    $token = [string]$cfg.token
    if (-not $apiUrl -or -not $token) {
        throw "config.json missing apiUrl or token"
    }
    return @{
        ApiUrl = $apiUrl.TrimEnd('/')
        Token  = $token
        Serial = if ($cfg.serialNumber) { [string]$cfg.serialNumber } else { $null }
    }
}

function Get-BypassHeaders([string]$Token) {
    $headers = @{
        Authorization = "Bearer $Token"
    }
    $bypass = $env:VERCEL_AUTOMATION_BYPASS_SECRET
    if (-not $bypass) { $bypass = $env:VERCEL_PROTECTION_BYPASS_SECRET }
    if ($bypass) {
        $headers["x-vercel-protection-bypass"] = $bypass
    }
    return $headers
}

function Get-ServerTargetVersion {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$SerialNumber
    )
    $uri = "$ApiUrl/api/agent/config"
    if ($SerialNumber) {
        $uri = "$uri`?serialNumber=$([uri]::EscapeDataString($SerialNumber))"
    }
    $headers = Get-BypassHeaders -Token $Token
    $resp = Invoke-RestMethod -Uri $uri -Headers $headers -Method GET -TimeoutSec 45
    $ver = $null
    if ($resp.agentFleetStableVersion) { $ver = [string]$resp.agentFleetStableVersion }
    elseif ($resp.agentScriptVersion) { $ver = [string]$resp.agentScriptVersion }
    elseif ($resp.config -and $resp.config.agentScriptVersion) {
        $ver = [string]$resp.config.agentScriptVersion
    }
    if (-not $ver) { throw "Server config missing agentScriptVersion" }
    return @{
        Version = $ver.Trim()
        FilesBase = if ($resp.agentFleetStableFilesBase) {
            [string]$resp.agentFleetStableFilesBase
        } else {
            "$ApiUrl/api/agent/files"
        }
        Bypass = if ($resp.vercelProtectionBypass) { [string]$resp.vercelProtectionBypass } else { $null }
        Force = [bool]$resp.forceAgentUpdate
    }
}

function Download-AgentFile {
    param(
        [string]$Url,
        [string]$Dest,
        [hashtable]$Headers
    )
    $dir = Split-Path -Parent $Dest
    if (-not (Test-Path -LiteralPath $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
    $response = Invoke-WebRequest -Uri $Url -Headers $Headers -OutFile $Dest `
        -UseBasicParsing -TimeoutSec 120 -PassThru
    $expectedHash = [string]$response.Headers["X-Agent-SHA256"]
    if ($expectedHash) {
        $actualHash = (Get-FileHash -LiteralPath $Dest -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash.Trim().ToLowerInvariant()) {
            throw "SHA256 mismatch for $Url"
        }
    }
    Unblock-File -LiteralPath $Dest -ErrorAction SilentlyContinue
}

function Invoke-WatchdogUpdate {
    param(
        [string]$ApiUrl,
        [string]$Token,
        [string]$FilesBase,
        [string]$BypassSecret,
        [bool]$Force
    )
    $headers = @{
        Authorization = "Bearer $Token"
    }
    if ($BypassSecret) {
        $headers["x-vercel-protection-bypass"] = $BypassSecret
    } else {
        $headers = Get-BypassHeaders -Token $Token
    }

    $stage = Join-Path $env:TEMP "PwCOfficePulse-recovery-$([Guid]::NewGuid().ToString('N'))"
    New-Item -ItemType Directory -Path (Join-Path $stage "lib") -Force | Out-Null
    try {
        $pairs = @(
            @{ name = "setup.ps1"; dest = Join-Path $stage "setup.ps1" },
            @{ name = "update.ps1"; dest = Join-Path $stage "update.ps1" },
            @{ name = "agent-download.ps1"; dest = Join-Path $stage "lib\agent-download.ps1" },
            @{ name = "agent-storage.ps1"; dest = Join-Path $stage "lib\agent-storage.ps1" },
            @{ name = "version.txt"; dest = Join-Path $stage "version.txt" },
            @{ name = "office-heartbeat.ps1"; dest = Join-Path $stage "office-heartbeat.ps1" },
            @{ name = "install.ps1"; dest = Join-Path $stage "install.ps1" },
            @{ name = "uninstall.ps1"; dest = Join-Path $stage "uninstall.ps1" },
            @{ name = "test-connection.ps1"; dest = Join-Path $stage "test-connection.ps1" }
        )

        foreach ($pair in $pairs) {
            $url = "$($FilesBase.TrimEnd('/'))/$($pair.name)"
            Write-WatchdogLog "Staging agent file $($pair.name)"
            Download-AgentFile -Url $url -Dest $pair.dest -Headers $headers
        }

        $stagedVersion = (Get-Content -LiteralPath (Join-Path $stage "version.txt") `
            -Raw -Encoding UTF8).Trim()
        if ($stagedVersion -notmatch '^\d+(\.\d+){0,3}$') {
            throw "Staged version.txt is invalid"
        }

        $updatePs1 = Join-Path $stage "update.ps1"
        $argList = @(
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-File", $updatePs1,
            "-ApiUrl", $ApiUrl,
            "-Token", $Token,
            "-FilesBaseOverride", $FilesBase,
            "-Silent"
        )
        if ($Force) { $argList += "-Force" }

        Write-WatchdogLog "Running staged update.ps1 -Silent (force=$Force)"
        $proc = Start-Process -FilePath "powershell.exe" -ArgumentList $argList `
            -Wait -PassThru -WindowStyle Hidden
        Write-WatchdogLog "staged update.ps1 exit=$($proc.ExitCode)"
        return $proc.ExitCode
    } finally {
        Remove-Item -LiteralPath $stage -Recurse -Force -ErrorAction SilentlyContinue
    }
}

try {
    Write-WatchdogLog "START watchdog"
    $cfg = Get-AgentConfig
    $local = Get-LocalVersion
    $target = Get-ServerTargetVersion -ApiUrl $cfg.ApiUrl -Token $cfg.Token -SerialNumber $cfg.Serial
    Write-WatchdogLog "local=$local target=$($target.Version) force=$($target.Force)"

    if ((Compare-AgentVersion $local $target.Version) -gt 0) {
        Write-WatchdogLog "OK local ahead of fleet-stable; watchdog will not downgrade"
        exit 0
    }

    $behind = (Compare-AgentVersion $target.Version $local) -gt 0
    if (-not $behind -and -not $target.Force) {
        Write-WatchdogLog "OK already current"
        exit 0
    }

    $exitCode = Invoke-WatchdogUpdate -ApiUrl $cfg.ApiUrl -Token $cfg.Token `
        -FilesBase $target.FilesBase -BypassSecret $target.Bypass -Force:([bool]$target.Force)
    $after = Get-LocalVersion
    Write-WatchdogLog "DONE local=$after exit=$exitCode"
    if ($exitCode -ne 0) { exit $exitCode }
    if ((Compare-AgentVersion $after $target.Version) -lt 0) {
        Write-WatchdogLog "ERROR repair exited successfully but local remains behind target"
        exit 1
    }
    exit 0
} catch {
    Write-WatchdogLog "ERROR $($_.Exception.Message)"
    exit 1
}
