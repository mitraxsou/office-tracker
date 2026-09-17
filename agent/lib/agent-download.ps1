# Shared agent download helpers for setup.ps1 and update.ps1

$script:AgentDownloadFiles = @(
    "office-heartbeat.ps1",
    "setup.ps1",
    "update.ps1",
    "install.ps1",
    "uninstall.ps1",
    "version.txt",
    "test-connection.ps1",
    "agent-download.ps1",
    "agent-storage.ps1"
)

function Get-AgentInstallDir {
    Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

function Get-AgentVersionPath {
    Join-Path (Get-AgentInstallDir) "version.txt"
}

function Remove-MarkOfWeb {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path) {
        Unblock-File -LiteralPath $Path -ErrorAction SilentlyContinue
    }
}

function Remove-MarkOfWebFromTree {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path)) { return }
    Get-ChildItem -LiteralPath $Path -File -Recurse -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-MarkOfWeb -Path $_.FullName }
}

function Test-AgentVersionFormat {
    param([string]$Version)
    $t = [string]$Version
    if (-not $t) { return $false }
    return $t.Trim() -match '^\d+(\.\d+){0,3}$'
}

function Normalize-AgentVersionString {
    param([string]$Version)
    if (Test-AgentVersionFormat $Version) { return $Version.Trim() }
    return "0.0.0"
}

function Compare-AgentVersion {
    param([string]$Left, [string]$Right)
    $parse = {
        param([string]$v)
        $normalized = Normalize-AgentVersionString $v
        $normalized.Split(".") | ForEach-Object {
            $part = 0
            [void][int]::TryParse($_, [ref]$part)
            $part
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

function Get-LocalAgentVersion {
    $path = Get-AgentVersionPath
    if (-not (Test-Path $path)) { return "0.0.0" }
    $fromFile = Get-Content $path -Raw -ErrorAction SilentlyContinue
    if (-not $fromFile) { return "0.0.0" }
    return Normalize-AgentVersionString $fromFile.Trim()
}

function Remove-AgentScriptParamBlock {
    param([string]$Content)
    if (-not $Content) { return $Content }
    if ($Content -notmatch '^\s*param\s*\(') { return $Content }

    $idx = $Content.IndexOf("param")
    $depth = 0
    $inString = $false
    $quote = [char]0
    for ($i = $idx; $i -lt $Content.Length; $i++) {
        $ch = $Content[$i]
        if ($inString) {
            if ($ch -eq $quote) { $inString = $false }
            continue
        }
        if ($ch -eq '"' -or $ch -eq "'") {
            $inString = $true
            $quote = $ch
            continue
        }
        if ($ch -eq '(') { $depth++ }
        elseif ($ch -eq ')') {
            $depth--
            if ($depth -eq 0) {
                return $Content.Substring($i + 1).TrimStart()
            }
        }
    }
    return $Content
}

function Publish-AgentScriptTxt {
    param([string]$Ps1Path)
    Remove-MarkOfWeb -Path $Ps1Path
    $txtPath = [System.IO.Path]::ChangeExtension($Ps1Path, ".txt")
    $raw = Get-Content -LiteralPath $Ps1Path -Raw
    $body = Remove-AgentScriptParamBlock $raw
    Set-Content -LiteralPath $txtPath -Value $body -Encoding UTF8
    Remove-MarkOfWeb -Path $txtPath
    return $txtPath
}

function Invoke-AgentScriptBypass {
    param(
        [string]$Ps1Path,
        [hashtable]$BoundVars = @{},
        [switch]$Hidden,
        [switch]$Wait
    )
    $txtPath = Publish-AgentScriptTxt -Ps1Path $Ps1Path
    $setupDir = [System.IO.Path]::GetDirectoryName($Ps1Path)
    $assignments = @()
    foreach ($entry in $BoundVars.GetEnumerator()) {
        $key = $entry.Key
        $val = $entry.Value
        if ($val -is [switch]) {
            if ($val) { $assignments += "`$$key = `$true" }
            continue
        }
        $sval = [string]$val -replace "'", "''"
        $assignments += "`$$key = '$sval'"
    }
    if ($setupDir) {
        $rootEsc = $setupDir -replace "'", "''"
        $assignments += "`$env:OFFICEPULSE_SETUP_ROOT = '$rootEsc'"
    }
    $prefix = if ($assignments.Count) { ($assignments -join "; ") + "; " } else { "" }
    $libPreload = @()
    if ($setupDir) {
        foreach ($rel in @("lib\agent-download.ps1", "lib\agent-storage.ps1")) {
            $libPath = Join-Path $setupDir $rel
            if (Test-Path -LiteralPath $libPath) {
                $libEsc = $libPath -replace "'", "''"
                $libPreload += "Unblock-File -LiteralPath '$libEsc' -ErrorAction SilentlyContinue; . '$libEsc'"
            }
        }
    }
    $preload = if ($libPreload.Count) { ($libPreload -join "; ") + "; " } else { "" }
    $command = "${prefix}${preload}`$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s"
    $windowStyle = if ($Hidden) { "Hidden" } else { "Normal" }
    $waitFlag = if ($Wait) { $true } else { $false }
    $proc = Start-Process -FilePath "powershell.exe" `
        -ArgumentList @(
            "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
            "-WindowStyle", $windowStyle, "-Command", "& { $command }"
        ) -WindowStyle $windowStyle -PassThru -Wait:$waitFlag
    if ($Wait -and $proc) { return $proc.ExitCode }
    return 0
}

function New-AgentDownloadHeaders {
    param([string]$Token, [string]$BypassSecret)
    $headers = @{ Authorization = "Bearer $Token" }
    if ($BypassSecret) {
        $headers["x-vercel-protection-bypass"] = $BypassSecret
    }
    return $headers
}

function Test-AgentBearerToken {
    param([string]$ApiUrl, [string]$Token)
    if (-not $ApiUrl -or -not $Token) { return $false }
    $uri = "$($ApiUrl.TrimEnd('/'))/api/agent/config"
    try {
        $req = [System.Net.HttpWebRequest]::Create($uri)
        $req.Method = "GET"
        $req.Timeout = 30000
        [void]$req.Headers.Add("Authorization", "Bearer $Token")
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        $resp.Close()
        return $code -eq 200
    } catch [System.Net.WebException] {
        return $false
    } catch {
        return $false
    }
}

function Get-AgentDownloadConfig {
    param([string]$ApiUrl, [string]$Token)
    $result = @{
        FilesBase = "$($ApiUrl.TrimEnd('/'))/api/agent/files"
        BypassSecret = $null
    }
    try {
        $cfg = Invoke-RestMethod -Uri "$ApiUrl/api/agent/config" `
            -Headers @{ Authorization = "Bearer $Token" } `
            -TimeoutSec 30 -UseBasicParsing
        if ($cfg.agentScriptFilesBase) {
            $result.FilesBase = [string]$cfg.agentScriptFilesBase.TrimEnd("/")
        } elseif ($cfg.agentScriptFallbackBase) {
            $legacy = [string]$cfg.agentScriptFallbackBase.TrimEnd("/")
            $result.FilesBase = if ($legacy -match "/api/agent/files") { $legacy } else { "$legacy" }
        }
        if ($cfg.vercelProtectionBypass) {
            $result.BypassSecret = [string]$cfg.vercelProtectionBypass
        }
    } catch {}
    return $result
}

function Download-AgentScriptsFromApp {
    param(
        [string]$FilesBase,
        [string]$Token,
        [string]$BypassSecret,
        [string]$DestDir,
        [scriptblock]$Log = { param($m) }
    )
    New-Item -ItemType Directory -Path $DestDir -Force | Out-Null
    $headers = New-AgentDownloadHeaders -Token $Token -BypassSecret $BypassSecret
    foreach ($file in $script:AgentDownloadFiles) {
        $url = "$FilesBase/$file"
        $dest = if ($file -eq "agent-download.ps1" -or $file -eq "agent-storage.ps1") {
            $libDir = Join-Path $DestDir "lib"
            New-Item -ItemType Directory -Path $libDir -Force | Out-Null
            Join-Path $libDir $file
        } else {
            Join-Path $DestDir $file
        }
        & $Log "Downloading $url"
        Invoke-WebRequest -Uri $url -Headers $headers -OutFile $dest -UseBasicParsing -TimeoutSec 120
        Remove-MarkOfWeb -Path $dest
        if ($file -eq "version.txt") {
            $ver = (Get-Content -LiteralPath $dest -Raw -ErrorAction Stop).Trim()
            if (-not (Test-AgentVersionFormat $ver)) {
                throw "Downloaded version.txt is not a valid agent version (got $($ver.Length) chars)"
            }
        }
    }
}
