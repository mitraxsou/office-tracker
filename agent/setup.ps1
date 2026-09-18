# My Office Pulse unified setup. Fresh install OR update without zip.
#
# If config.json is missing: download scripts from /api/agent/files/* and register tasks.
# If config exists: version check and refresh scripts from the server.
#
# Usage:
#   .\setup.ps1 -ApiUrl "https://your-app.vercel.app" -Token "your-agent-token"
#   .\setup.ps1 -Silent
#   .\setup.ps1 -Force
#
# No script-level param() - IEX from bootstrap leaves $ApiUrl/$Token in caller scope;
# param() would shadow them and break fresh install. -File switches are parsed from $args.

$ErrorActionPreference = "Stop"

if (-not (Get-Variable -Name Silent -Scope 0 -ErrorAction SilentlyContinue)) { $Silent = $false }
if (-not (Get-Variable -Name Verbose -Scope 0 -ErrorAction SilentlyContinue)) { $Verbose = $false }
if (-not (Get-Variable -Name Force -Scope 0 -ErrorAction SilentlyContinue)) { $Force = $false }
if (-not (Get-Variable -Name RequireAdmin -Scope 0 -ErrorAction SilentlyContinue)) { $RequireAdmin = $false }

if ($null -ne $args -and $args.Count -gt 0) {
    for ($i = 0; $i -lt $args.Count; $i++) {
        switch ([string]$args[$i]) {
            "-ApiUrl" {
                if ($i + 1 -lt $args.Count) { $ApiUrl = [string]$args[$i + 1]; $i++ }
            }
            "-Token" {
                if ($i + 1 -lt $args.Count) { $Token = [string]$args[$i + 1]; $i++ }
            }
            "-Silent" { $Silent = $true }
            "-Verbose" { $Verbose = $true }
            "-Force" { $Force = $true }
            "-RequireAdmin" { $RequireAdmin = $true }
        }
    }
}
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$TaskName = "PwCOfficePulse"
$TaskDescription = "My Office Pulse - office hours tracker"
$LegacyTaskNames = @("OfficeTrackerHeartbeat", "PwCOfficePulse")
$LegacyUpdateTaskName = "PwCOfficePulseUpdate"

function Get-InstallDir {
    Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

function Get-ConfigPath {
    Join-Path (Get-InstallDir) "config.json"
}

function Get-LockPath {
    Join-Path (Get-InstallDir) ".setup.lock"
}

function Get-ForceUpdateMarkerPath {
    Join-Path (Get-InstallDir) "force-update.txt"
}

function Get-AgentDownloadModuleCandidates {
    $candidates = @()
    if ($PSScriptRoot) {
        $candidates += Join-Path $PSScriptRoot "lib\agent-download.ps1"
        $candidates += Join-Path $PSScriptRoot "agent-download.ps1"
    }
    if ($env:OFFICEPULSE_SETUP_ROOT) {
        $candidates += Join-Path $env:OFFICEPULSE_SETUP_ROOT "lib\agent-download.ps1"
        $candidates += Join-Path $env:OFFICEPULSE_SETUP_ROOT "agent-download.ps1"
    }
    $candidates += Join-Path (Get-InstallDir) "lib\agent-download.ps1"
    return $candidates
}

function Get-AgentStorageModuleCandidates {
    $candidates = @()
    if ($PSScriptRoot) {
        $candidates += Join-Path $PSScriptRoot "lib\agent-storage.ps1"
        $candidates += Join-Path $PSScriptRoot "agent-storage.ps1"
    }
    if ($env:OFFICEPULSE_SETUP_ROOT) {
        $candidates += Join-Path $env:OFFICEPULSE_SETUP_ROOT "lib\agent-storage.ps1"
        $candidates += Join-Path $env:OFFICEPULSE_SETUP_ROOT "agent-storage.ps1"
    }
    $candidates += Join-Path (Get-InstallDir) "lib\agent-storage.ps1"
    return $candidates
}

function Write-SetupLog([string]$Message) {
    $logDir = Join-Path (Get-InstallDir) "logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path (Join-Path $logDir "setup.log") -Value $line -ErrorAction SilentlyContinue
    if ($Verbose -and -not $Silent) { Write-Host $Message }
}

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Test-ExistingInstall {
    $installDir = Get-InstallDir
    $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    return (Test-Path $installDir) -and ($null -ne $task)
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

function Send-LifecycleUninstallFromConfig {
    $configPath = Get-ConfigPath
    if (-not (Test-Path -LiteralPath $configPath)) { return }
    try {
        $config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
        $apiUrl = [string]$config.apiUrl
        $token = [string]$config.token
        $serial = Get-LaptopSerial
        if (-not $serial -and $config.serialNumber) { $serial = [string]$config.serialNumber }
        if (-not $apiUrl -or -not $token -or -not $serial) {
            Write-SetupLog "WARN lifecycle skip: missing apiUrl, token, or serial"
            return
        }
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        $versionPath = Join-Path (Get-InstallDir) "version.txt"
        $scriptVersion = if (Test-Path -LiteralPath $versionPath) { (Get-Content -LiteralPath $versionPath -Raw).Trim() } else { $null }
        $payload = @{
            token         = $token
            serialNumber  = $serial
            event         = "uninstall"
            hostname      = $env:COMPUTERNAME
            scriptVersion = $scriptVersion
        } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$($apiUrl.TrimEnd('/'))/api/agent/lifecycle" -Method POST `
            -ContentType "application/json" -Body $payload -TimeoutSec 20 | Out-Null
        Write-SetupLog "OK lifecycle uninstall reported before force reinstall"
    } catch {
        Write-SetupLog "WARN lifecycle POST failed: $($_.Exception.Message)"
    }
}

function Stop-RunningAgentProcesses {
    foreach ($taskName in @($TaskName) + $LegacyTaskNames) {
        Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1

    $needles = @("OfficeTracker", "PwCOfficePulse", "office-heartbeat", "run-heartbeat.vbs")
    foreach ($procName in @("wscript", "powershell")) {
        Get-Process -Name $procName -ErrorAction SilentlyContinue | ForEach-Object {
            try {
                $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($_.Id)" -ErrorAction Stop).CommandLine
                if (-not $cmd) { return }
                foreach ($needle in $needles) {
                    if ($cmd -like "*$needle*") {
                        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
                        break
                    }
                }
            } catch {
                # ignore per-process query failures
            }
        }
    }
    Start-Sleep -Seconds 2
}

function Copy-AgentFileWithRetry {
    param(
        [string]$Source,
        [string]$Destination,
        [int]$MaxAttempts = 8
    )
    Remove-MarkOfWeb -Path $Source
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $destDir = Split-Path -Parent $Destination
            if ($destDir -and -not (Test-Path -LiteralPath $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            Copy-Item -LiteralPath $Source -Destination $Destination -Force
            Remove-MarkOfWeb -Path $Destination
            return
        } catch {
            if ($attempt -ge $MaxAttempts) { throw }
            Write-SetupLog "WARN copy retry $attempt/${MaxAttempts}: $($_.Exception.Message)"
            Stop-RunningAgentProcesses
            Start-Sleep -Milliseconds 400
        }
    }
}

function Reset-LocalAgentInstall {
    Write-SetupLog "Force reinstall: clearing local agent (same as uninstall.ps1)"
    Send-LifecycleUninstallFromConfig
    Stop-RunningAgentProcesses

    foreach ($legacy in $LegacyTaskNames) {
        Unregister-ScheduledTask -TaskName $legacy -Confirm:$false -ErrorAction SilentlyContinue
    }
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

    $startupDir = [Environment]::GetFolderPath("Startup")
    foreach ($legacy in @("OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk", "My Office Pulse.lnk")) {
        $legacyPath = Join-Path $startupDir $legacy
        if (Test-Path -LiteralPath $legacyPath) {
            Remove-Item -LiteralPath $legacyPath -Force -ErrorAction SilentlyContinue
        }
    }

    $userDir = Get-InstallDir
    if (Test-Path -LiteralPath $userDir) {
        Remove-Item -LiteralPath $userDir -Recurse -Force -ErrorAction SilentlyContinue
        Write-SetupLog "Removed $userDir"
    }

    $lockPath = Get-LockPath
    if (Test-Path -LiteralPath $lockPath) {
        Remove-Item -LiteralPath $lockPath -Force -ErrorAction SilentlyContinue
    }
}

function Get-AgentLayoutScriptFiles {
    @(
        "version.txt",
        "office-heartbeat.ps1",
        "setup.ps1",
        "update.ps1",
        "install.ps1",
        "uninstall.ps1",
        "lib\agent-download.ps1",
        "lib\agent-storage.ps1",
        "test-connection.ps1"
    )
}

function Get-MissingAgentLayoutFiles {
    param(
        [string]$InstallDir,
        [switch]$IncludeGenerated,
        [switch]$IncludeConfig
    )
    $required = @()
    if ($IncludeConfig) { $required += "config.json" }
    $required += Get-AgentLayoutScriptFiles
    if ($IncludeGenerated) { $required += "run-heartbeat.vbs" }
    $missing = @()
    foreach ($rel in $required) {
        $path = Join-Path $InstallDir $rel
        if (-not (Test-Path -LiteralPath $path)) {
            $missing += $rel
        }
    }
    return @($missing)
}

function Get-AgentDownloadDestPath {
    param([string]$DestDir, [string]$File)
    if ($File -eq "agent-download.ps1" -or $File -eq "agent-storage.ps1") {
        $libDir = Join-Path $DestDir "lib"
        New-Item -ItemType Directory -Path $libDir -Force | Out-Null
        return Join-Path $libDir $File
    }
    return Join-Path $DestDir $File
}

function Complete-DownloadedAgentScripts {
    param(
        [string]$FilesBase,
        [string]$Token,
        [string]$BypassSecret,
        [string]$DestDir
    )
    $refreshedLib = Join-Path $DestDir "lib\agent-download.ps1"
    if (Test-Path -LiteralPath $refreshedLib) {
        . $refreshedLib
    }

    $files = @()
    if ($script:AgentDownloadFiles) {
        $files += @($script:AgentDownloadFiles)
    }
    foreach ($extra in @(
        "office-heartbeat.ps1",
        "setup.ps1",
        "update.ps1",
        "install.ps1",
        "uninstall.ps1",
        "version.txt",
        "test-connection.ps1",
        "agent-download.ps1",
        "agent-storage.ps1"
    )) {
        if ($files -notcontains $extra) { $files += $extra }
    }

    $headers = New-AgentDownloadHeaders -Token $Token -BypassSecret $BypassSecret
    foreach ($file in $files) {
        $dest = Get-AgentDownloadDestPath -DestDir $DestDir -File $file
        if (Test-Path -LiteralPath $dest) { continue }
        $url = "$FilesBase/$file"
        Write-SetupLog "Downloading missing $url"
        Invoke-WebRequest -Uri $url -Headers $headers -OutFile $dest -UseBasicParsing -TimeoutSec 120
        if (Get-Command Remove-MarkOfWeb -ErrorAction SilentlyContinue) {
            Remove-MarkOfWeb -Path $dest
        }
    }
}

function Test-AgentInstallLayout {
    param([string]$InstallDir)
    $missing = Get-MissingAgentLayoutFiles -InstallDir $InstallDir -IncludeGenerated -IncludeConfig
    if ($missing.Count -gt 0) {
        throw "Install incomplete. Missing under $InstallDir`: $($missing -join ', ')"
    }
    Write-SetupLog "OK install layout verified"
}

function Invoke-BlockedAgentScript {
    param(
        [string]$ScriptPath,
        [hashtable]$BoundVars = @{}
    )
    Invoke-AgentScriptBypass -Ps1Path $ScriptPath -BoundVars $BoundVars -Hidden -Wait | Out-Null
}

function New-HiddenRunner {
    param(
        [string]$ScriptPath,
        [string]$Dir
    )
    $txtPath = Publish-AgentScriptTxt -Ps1Path $ScriptPath
    $vbsPath = Join-Path $Dir "run-heartbeat.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""& { `$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s }""", 0, False
"@
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII
    return $vbsPath
}

function New-HeartbeatTaskTriggers {
    $repeatTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
        -RepetitionInterval (New-TimeSpan -Minutes 2) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn

    $unlockTrigger = $null
    $resumeTrigger = $null
    try {
        $unlockTrigger = New-CimInstance -Namespace "Root\Microsoft\Windows\TaskScheduler" `
            -ClassName "MSFT_TaskSessionStateChangeTrigger" -ClientOnly
        $unlockTrigger.Enabled = $true
        $unlockTrigger.StateChange = 7
        $unlockTrigger.Delay = "PT30S"
    } catch {}

    try {
        $resumeTrigger = New-CimInstance -Namespace "Root\Microsoft\Windows\TaskScheduler" `
            -ClassName "MSFT_TaskEventTrigger" -ClientOnly
        $resumeTrigger.Enabled = $true
        $resumeTrigger.Subscription = @"
<QueryList>
  <Query Id="0" Path="System">
    <Select Path="System">*[System[Provider[@Name='Microsoft-Windows-Kernel-Power'] and EventID=107]]</Select>
  </Query>
</QueryList>
"@
        $resumeTrigger.ValueQueries = ""
        $resumeTrigger.Delay = "PT45S"
    } catch {}

    $triggers = @($repeatTrigger, $logonTrigger)
    if ($unlockTrigger) { $triggers += $unlockTrigger }
    if ($resumeTrigger) { $triggers += $resumeTrigger }
    return $triggers
}

function Register-HiddenTask {
    param(
        [string]$VbsPath,
        [string]$InstallDir
    )
    foreach ($legacy in $LegacyTaskNames) {
        Unregister-ScheduledTask -TaskName $legacy -Confirm:$false -ErrorAction SilentlyContinue
    }

    $wscript = (Get-Command wscript.exe).Source
    $actionArgs = "//B //Nologo `"$VbsPath`""

    $action = New-ScheduledTaskAction -Execute $wscript -Argument $actionArgs
    $triggers = New-HeartbeatTaskTriggers
    $repeatTrigger = $triggers[0]
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
        -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -MultipleInstances Queue

    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers `
            -Principal $principal -Settings $settings -Description $TaskDescription -Force | Out-Null
    } catch {
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $repeatTrigger `
            -Principal $principal -Settings $settings -Description $TaskDescription -Force | Out-Null
    }

    $startupDir = [Environment]::GetFolderPath("Startup")
    foreach ($legacy in @("OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk", "My Office Pulse.lnk")) {
        $legacyPath = Join-Path $startupDir $legacy
        if (Test-Path $legacyPath) { Remove-Item $legacyPath -Force }
    }

    $shortcutPath = Join-Path $startupDir "My Office Pulse.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $wscript
    $shortcut.Arguments = $actionArgs
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.WindowStyle = 7
    $shortcut.Description = $TaskDescription
    $shortcut.Save()
}

function Remove-LegacyUpdateTask {
    # Heartbeat runs hourly update checks inline; a separate scheduled task is redundant
    # and often fails with Access denied on non-admin PwC laptops.
    Unregister-ScheduledTask -TaskName $LegacyUpdateTaskName -Confirm:$false -ErrorAction SilentlyContinue
}

function Install-AgentScripts {
    param(
        [string]$SourceDir,
        [string]$TargetDir
    )
    foreach ($file in $script:AgentDownloadFiles) {
        if ($file -eq "agent-download.ps1" -or $file -eq "agent-storage.ps1") {
            $src = Join-Path $SourceDir "lib\$file"
            if (-not (Test-Path $src)) {
                $src = Join-Path $SourceDir $file
            }
            if (Test-Path $src) {
                $libDir = Join-Path $TargetDir "lib"
                New-Item -ItemType Directory -Path $libDir -Force | Out-Null
                $destination = Join-Path $libDir $file
                Copy-AgentFileWithRetry -Source $src -Destination $destination
            }
            continue
        }
        $src = Join-Path $SourceDir $file
        if (Test-Path $src) {
            $destination = Join-Path $TargetDir $file
            Copy-AgentFileWithRetry -Source $src -Destination $destination
        }
    }
    foreach ($rel in (Get-AgentLayoutScriptFiles)) {
        $src = Join-Path $SourceDir $rel
        if (-not (Test-Path -LiteralPath $src)) { continue }
        $destination = Join-Path $TargetDir $rel
        if (-not (Test-Path -LiteralPath $destination)) {
            Copy-AgentFileWithRetry -Source $src -Destination $destination
        }
    }
}

function Publish-InstalledAgentScripts {
    param([string]$InstallDir)
    foreach ($name in @("office-heartbeat.ps1", "setup.ps1", "update.ps1")) {
        $path = Join-Path $InstallDir $name
        if (Test-Path $path) {
            Publish-AgentScriptTxt -Ps1Path $path | Out-Null
        }
    }
}

function Write-AgentConfig {
    param(
        [string]$InstallDir,
        [string]$ApiUrlValue,
        [string]$TokenValue
    )
    $serial = Get-LaptopSerial
    $config = @{
        apiUrl = $ApiUrlValue.TrimEnd("/")
        token  = $TokenValue
    }
    if ($serial) { $config.serialNumber = $serial }
    ($config | ConvertTo-Json) | Set-Content -Path (Join-Path $InstallDir "config.json") -Encoding UTF8
}

function Install-AdminLevel {
    param(
        [string]$ApiUrlValue,
        [string]$TokenValue
    )
    if (-not (Test-IsAdmin)) {
        Write-Host "Re-launching with admin (UAC prompt)..." -ForegroundColor Yellow
        $args = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath,
            "-ApiUrl", $ApiUrlValue, "-Token", $TokenValue, "-RequireAdmin"
        )
        Start-Process powershell.exe -Verb RunAs -ArgumentList $args
        exit 0
    }

    $installDir = "C:\Program Files\OfficeTracker"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    $localConfigDir = Get-InstallDir
    if (-not (Test-Path $localConfigDir)) { New-Item -ItemType Directory -Path $localConfigDir -Force | Out-Null }

    Install-AgentScripts -SourceDir $PSScriptRoot -TargetDir $installDir
    Install-AgentScripts -SourceDir $PSScriptRoot -TargetDir $localConfigDir
    Write-AgentConfig -InstallDir $localConfigDir -ApiUrlValue $ApiUrlValue -TokenValue $TokenValue

    $heartbeatScript = Join-Path $installDir "office-heartbeat.ps1"
    $vbsPath = New-HiddenRunner -ScriptPath $heartbeatScript -Dir $localConfigDir
    Register-HiddenTask -VbsPath $vbsPath -InstallDir $localConfigDir
    Remove-LegacyUpdateTask

    Write-Host ""
    Write-Host "My Office Pulse installed (admin / Program Files)" -ForegroundColor Green
    Write-Host "Scripts:  $installDir"
    Write-Host "Config:   $(Join-Path $localConfigDir 'config.json')"
}

function Complete-Install {
    param(
        [string]$InstallDir,
        [bool]$IsReinstall,
        [bool]$ScriptsUpdated
    )
    $heartbeatScript = Join-Path $InstallDir "office-heartbeat.ps1"
    Publish-InstalledAgentScripts -InstallDir $InstallDir
    $vbsPath = New-HiddenRunner -ScriptPath $heartbeatScript -Dir $InstallDir
    Register-HiddenTask -VbsPath $vbsPath -InstallDir $InstallDir
    Remove-LegacyUpdateTask

    if ($ScriptsUpdated -and -not $Force) {
        Write-SetupLog "Skipping inline heartbeat after setup (task will sync). Run test-connection.ps1 to verify."
    }

    if ($Silent) { return }

    if ($IsReinstall) {
        Write-Host "My Office Pulse reinstalled (local agent reset and scripts refreshed)." -ForegroundColor Green
        return
    }

    Write-Host ""
    Write-Host "My Office Pulse installed (user-level)" -ForegroundColor Green
    Write-Host "Install dir:     $InstallDir"
    Write-Host "Scheduled task:  $TaskName (hidden, every 2 min)"
    Write-Host "Startup shortcut: My Office Pulse.lnk"
    Write-Host "Config:          $(Join-Path $InstallDir 'config.json')"
    Write-Host ""
    Write-Host "When a new version is published, download the agent zip from Settings and run the reinstall command."
}

if (-not (Get-Command Publish-AgentScriptTxt -ErrorAction SilentlyContinue)) {
    foreach ($path in Get-AgentDownloadModuleCandidates) {
        if (Test-Path -LiteralPath $path) {
            . $path
            break
        }
    }
    if (-not (Get-Command Publish-AgentScriptTxt -ErrorAction SilentlyContinue)) {
        throw "agent-download.ps1 module not found"
    }
}

if (-not (Get-Command Invoke-AgentLogMaintenance -ErrorAction SilentlyContinue)) {
    foreach ($path in Get-AgentStorageModuleCandidates) {
        if (Test-Path -LiteralPath $path) {
            . $path
            break
        }
    }
}

if (Get-Command Invoke-AgentLogMaintenance -ErrorAction SilentlyContinue) {
    Invoke-AgentLogMaintenance -Log { param($m) Write-SetupLog $m }
}

$installDir = Get-InstallDir
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$forceMarkerPath = Get-ForceUpdateMarkerPath
if (Test-Path -LiteralPath $forceMarkerPath) {
    $Force = $true
    Remove-Item -LiteralPath $forceMarkerPath -Force -ErrorAction SilentlyContinue
}

$configPath = Get-ConfigPath
$isFreshInstall = -not (Test-Path $configPath)
$shouldWriteAgentConfig = $false
$tokenChanged = $false
$apiChanged = $false

if (-not $ApiUrl -and $env:OFFICEPULSE_SETUP_API_URL) {
    $ApiUrl = [string]$env:OFFICEPULSE_SETUP_API_URL
}
if (-not $Token -and $env:OFFICEPULSE_SETUP_TOKEN) {
    $Token = [string]$env:OFFICEPULSE_SETUP_TOKEN
}

if ($isFreshInstall) {
    if (-not $ApiUrl -or -not $Token) {
        Write-SetupLog "ERROR fresh install requires ApiUrl and Token"
        if (-not $Silent) {
            Write-Host "ERROR: ApiUrl and Token are required for a fresh install." -ForegroundColor Red
        }
        exit 1
    }
    $shouldWriteAgentConfig = $true
} else {
    $localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
    $storedApiUrl = [string]$localConfig.apiUrl
    $storedToken = [string]$localConfig.token
    if (-not $ApiUrl) { $ApiUrl = $storedApiUrl.TrimEnd("/") }
    if (-not $Token) { $Token = $storedToken }
    $apiChanged = $ApiUrl.TrimEnd("/") -ne $storedApiUrl.TrimEnd("/")
    $tokenChanged = $Token -ne $storedToken
    if ($Force -or $apiChanged -or $tokenChanged) {
        $shouldWriteAgentConfig = $true
    }
}

if ($RequireAdmin) {
    Install-AdminLevel -ApiUrlValue $ApiUrl -TokenValue $Token
    exit 0
}

$lockPath = Get-LockPath
if (Test-Path $lockPath) {
    $lockAge = (Get-Date) - (Get-Item $lockPath).LastWriteTime
    if ($lockAge.TotalMinutes -lt 10) {
        Write-SetupLog "SKIP setup already in progress"
        exit 0
    }
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

Set-Content -Path $lockPath -Value (Get-Date -Format "o") -Encoding UTF8

$pendingForceReset = $Force -and (
    (Test-Path -LiteralPath (Get-ConfigPath)) -or (Test-ExistingInstall)
)
$isReinstallForComplete = Test-ExistingInstall

$tempDir = $null
try {
    if (-not (Test-AgentBearerToken -ApiUrl $ApiUrl -Token $Token)) {
        throw "Agent install token was rejected by the server. In Settings, refresh or regenerate your install token, then run the new reinstall command."
    }
    if ($shouldWriteAgentConfig -and -not $pendingForceReset) {
        Write-AgentConfig -InstallDir $installDir -ApiUrlValue $ApiUrl -TokenValue $Token
        if (-not $isFreshInstall) {
            $cfgReasonEarly = if ($Force) { "force" } elseif ($tokenChanged) { "token" } else { "apiUrl" }
            Write-SetupLog "Updated config.json early ($cfgReasonEarly)"
        }
    }
    $downloadCfg = Get-AgentDownloadConfig -ApiUrl $ApiUrl -Token $Token
    $tempDir = Join-Path $env:TEMP "PwCOfficePulse-setup-$([Guid]::NewGuid().ToString('N'))"
    Download-AgentScriptsFromApp -FilesBase $downloadCfg.FilesBase -Token $Token `
        -BypassSecret $downloadCfg.BypassSecret -DestDir $tempDir `
        -Log { param($m) Write-SetupLog $m }
    Complete-DownloadedAgentScripts -FilesBase $downloadCfg.FilesBase -Token $Token `
        -BypassSecret $downloadCfg.BypassSecret -DestDir $tempDir

    if ($pendingForceReset) {
        Reset-LocalAgentInstall
        if (-not (Test-Path -LiteralPath $installDir)) {
            New-Item -ItemType Directory -Path $installDir -Force | Out-Null
        }
        $isReinstallForComplete = $true
    }

    $newVersion = "0.0.0"
    $versionFile = Join-Path $tempDir "version.txt"
    if (Test-Path $versionFile) {
        $rawNewVersion = (Get-Content $versionFile -Raw).Trim()
        if (Get-Command Normalize-AgentVersionString -ErrorAction SilentlyContinue) {
            $newVersion = Normalize-AgentVersionString $rawNewVersion
        } elseif ($rawNewVersion -match '^\d+(\.\d+){0,3}$') {
            $newVersion = $rawNewVersion
        } else {
            Write-SetupLog "WARN invalid downloaded version.txt; treating as 0.0.0"
            $newVersion = "0.0.0"
        }
        if ($newVersion -eq "0.0.0" -and $rawNewVersion -ne "0.0.0") {
            Write-SetupLog "WARN rejected version string (len=$($rawNewVersion.Length))"
        }
    }

    $localVersion = Get-LocalAgentVersion
    $missingScripts = Get-MissingAgentLayoutFiles -InstallDir $installDir
    $shouldInstallScripts = $isFreshInstall -or $Force -or $pendingForceReset -or ((Compare-AgentVersion $newVersion $localVersion) -ne 0) -or ($missingScripts.Count -gt 0)

    if ($shouldInstallScripts) {
        $reason = if ($isFreshInstall) { "fresh install" } elseif ($Force) { "force" } elseif ($missingScripts.Count -gt 0) { "repair missing $($missingScripts -join ', ')" } else { "version $localVersion -> $newVersion" }
        Write-SetupLog "Installing scripts ($reason)"
        Install-AgentScripts -SourceDir $tempDir -TargetDir $installDir
    } else {
        Write-SetupLog "SKIP already at v$localVersion (server v$newVersion)"
    }

    if ($shouldWriteAgentConfig) {
        Write-AgentConfig -InstallDir $installDir -ApiUrlValue $ApiUrl -TokenValue $Token
        if (-not $isFreshInstall) {
            $cfgReason = if ($Force) { "force" } elseif ($tokenChanged) { "token" } else { "apiUrl" }
            Write-SetupLog "Updated config.json ($cfgReason)"
        }
    }

    Write-SetupLog "Registering scheduled task and shortcuts..."
    Complete-Install -InstallDir $installDir -IsReinstall $isReinstallForComplete -ScriptsUpdated $shouldInstallScripts
    Write-SetupLog "Verifying install layout..."
    Test-AgentInstallLayout -InstallDir $installDir

    if (Get-Command Invoke-AgentLogMaintenance -ErrorAction SilentlyContinue) {
        Invoke-AgentLogMaintenance -Log { param($m) Write-SetupLog $m }
    }

    $installedVersion = Get-LocalAgentVersion
    if (-not $Silent) {
        Write-Host ""
        Write-Host "SUCCESS: My Office Pulse agent v$installedVersion is installed." -ForegroundColor Green
        Write-Host "  Folder: $installDir" -ForegroundColor Gray
        Write-Host "  Log:    $(Join-Path $installDir 'logs\setup.log')" -ForegroundColor Gray
        Write-Host "  Test:   powershell -NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $installDir 'test-connection.ps1')`"" -ForegroundColor Cyan
    }
} catch {
    Write-SetupLog "ERROR $($_.Exception.Message)"
    if (-not $Silent) { Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red }
    exit 1
} finally {
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
    if ($tempDir -and (Test-Path $tempDir)) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
