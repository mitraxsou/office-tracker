# Shared agent download helpers for setup.ps1 and update.ps1

$script:AgentDownloadFiles = @(
    "office-heartbeat.ps1",
    "setup.ps1",
    "update.ps1",
    "install.ps1",
    "uninstall.ps1",
    "version.txt",
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

function Get-LocalAgentVersion {
    $path = Get-AgentVersionPath
    if (-not (Test-Path $path)) { return "0.0.0" }
    return (Get-Content $path -Raw -ErrorAction SilentlyContinue).Trim()
}

function Publish-AgentScriptTxt {
    param([string]$Ps1Path)
    Remove-MarkOfWeb -Path $Ps1Path
    $txtPath = [System.IO.Path]::ChangeExtension($Ps1Path, ".txt")
    Copy-Item $Ps1Path $txtPath -Force
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
    $prefix = if ($assignments.Count) { ($assignments -join "; ") + "; " } else { "" }
    $command = "${prefix}`$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s"
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
    }
}
