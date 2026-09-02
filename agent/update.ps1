# PwC Office Pulse agent updater. Downloads latest scripts from the server.
# NO admin required. Safe to run manually or from the heartbeat auto-update check.
#
# Usage:
#   .\update.ps1                              # reads config.json, silent by default when called internally
#   .\update.ps1 -ApiUrl "https://..." -Token "..." -Silent
#   .\update.ps1 -Verbose                     # show progress (manual runs)

param(
    [string]$ApiUrl,
    [string]$Token,
    [switch]$Silent,
    [switch]$Verbose
)

$ErrorActionPreference = "Stop"
$TaskName = "PwCOfficePulse"
$UpdateTaskName = "PwCOfficePulseUpdate"
$TaskDescription = "PwC Office Pulse - office hours tracker"
$UpdateTaskDescription = "PwC Office Pulse - hourly agent update check"
$LegacyTaskNames = @("OfficeTrackerHeartbeat", "PwCOfficePulse")
$ExtractFolder = "PwCOfficePulse"
$AgentFiles = @("office-heartbeat.ps1", "update.ps1", "uninstall.ps1", "install.ps1", "version.txt")

function Get-InstallDir {
    Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

function Get-ConfigPath {
    Join-Path (Get-InstallDir) "config.json"
}

function Get-VersionPath {
    Join-Path (Get-InstallDir) "version.txt"
}

function Get-LockPath {
    Join-Path (Get-InstallDir) ".update.lock"
}

function Write-UpdateLog([string]$Message) {
    $logDir = Join-Path (Get-InstallDir) "logs"
    if (-not (Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir -Force | Out-Null }
    $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message"
    Add-Content -Path (Join-Path $logDir "update.log") -Value $line -ErrorAction SilentlyContinue
    if ($Verbose -and -not $Silent) { Write-Host $Message }
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
    $path = Get-VersionPath
    if (-not (Test-Path $path)) { return "0.0.0" }
    return (Get-Content $path -Raw -ErrorAction SilentlyContinue).Trim()
}

function Publish-AgentScriptTxt {
    param([string]$Ps1Path)
    $txtPath = [System.IO.Path]::ChangeExtension($Ps1Path, ".txt")
    Copy-Item $Ps1Path $txtPath -Force
    return $txtPath
}

function New-HiddenRunner {
    param([string]$ScriptPath, [string]$Dir)
    $txtPath = Publish-AgentScriptTxt -Ps1Path $ScriptPath
    $vbsPath = Join-Path $Dir "run-heartbeat.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""& { `$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s }""", 0, False
"@
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII
    return $vbsPath
}

function New-UpdateHiddenRunner {
    param([string]$ScriptPath, [string]$Dir)
    $txtPath = Publish-AgentScriptTxt -Ps1Path $ScriptPath
    $vbsPath = Join-Path $Dir "run-update.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -Command ""& { `$Silent=`$true; `$s = Get-Content -Raw '$txtPath'; Invoke-Expression `$s }""", 0, False
"@
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII
    return $vbsPath
}

function Register-HourlyUpdateTask {
    param([string]$InstallDir)

    $updateScript = Join-Path $InstallDir "update.ps1"
    if (-not (Test-Path $updateScript)) { return }

    $vbsPath = New-UpdateHiddenRunner -ScriptPath $updateScript -Dir $InstallDir
    $wscript = (Get-Command wscript.exe).Source
    $actionArgs = "//B //Nologo `"$vbsPath`""
    $action = New-ScheduledTaskAction -Execute $wscript -Argument $actionArgs
    $hourlyTrigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
        -RepetitionInterval (New-TimeSpan -Hours 1) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $logonTrigger = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
        -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -MultipleInstances IgnoreNew

    try {
        Register-ScheduledTask -TaskName $UpdateTaskName -Action $action `
            -Trigger @($hourlyTrigger, $logonTrigger) -Principal $principal -Settings $settings `
            -Description $UpdateTaskDescription -Force | Out-Null
    } catch {
        Register-ScheduledTask -TaskName $UpdateTaskName -Action $action `
            -Trigger $hourlyTrigger -Principal $principal -Settings $settings `
            -Description $UpdateTaskDescription -Force | Out-Null
    }
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

function Refresh-ScheduledTask {
    param([string]$VbsPath, [string]$InstallDir)
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
    $shortcutPath = Join-Path $startupDir "PwC Office Pulse.lnk"
    $wsh = New-Object -ComObject WScript.Shell
    $shortcut = $wsh.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $wscript
    $shortcut.Arguments = $actionArgs
    $shortcut.WorkingDirectory = $InstallDir
    $shortcut.WindowStyle = 7
    $shortcut.Description = $TaskDescription
    $shortcut.Save()
}

function Resolve-AgentSourceDir {
    param([string]$ExtractRoot)
    $nested = Join-Path $ExtractRoot $ExtractFolder
    if (Test-Path (Join-Path $nested "office-heartbeat.ps1")) { return $nested }
    if (Test-Path (Join-Path $ExtractRoot "office-heartbeat.ps1")) { return $ExtractRoot }
    throw "Agent scripts not found in downloaded zip"
}

$installDir = Get-InstallDir
if (-not (Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
}

$configPath = Get-ConfigPath
if (-not $ApiUrl -or -not $Token) {
    if (-not (Test-Path $configPath)) {
        Write-UpdateLog "ERROR: config.json not found"
        if (-not $Silent) { Write-Host "ERROR: config.json not found. Run install.ps1 first." -ForegroundColor Red }
        exit 1
    }
    $localConfig = Get-Content $configPath -Raw | ConvertFrom-Json
    if (-not $ApiUrl) { $ApiUrl = $localConfig.apiUrl.TrimEnd("/") }
    if (-not $Token) { $Token = $localConfig.token }
}

$lockPath = Get-LockPath
if (Test-Path $lockPath) {
    $lockAge = (Get-Date) - (Get-Item $lockPath).LastWriteTime
    if ($lockAge.TotalMinutes -lt 10) {
        Write-UpdateLog "SKIP update already in progress"
        exit 0
    }
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
}

Set-Content -Path $lockPath -Value (Get-Date -Format "o") -Encoding UTF8

try {
    $headers = @{ Authorization = "Bearer $Token" }
    $tempZip = Join-Path $env:TEMP "PwCOfficePulse-agent-$([Guid]::NewGuid().ToString('N')).zip"
    $tempExtract = Join-Path $env:TEMP "PwCOfficePulse-extract-$([Guid]::NewGuid().ToString('N'))"

    Write-UpdateLog "Downloading agent from $ApiUrl/api/agent/download"
    Invoke-WebRequest -Uri "$ApiUrl/api/agent/download" -Headers $headers `
        -OutFile $tempZip -UseBasicParsing -TimeoutSec 120

    New-Item -ItemType Directory -Path $tempExtract -Force | Out-Null
    Expand-Archive -Path $tempZip -DestinationPath $tempExtract -Force

    $sourceDir = Resolve-AgentSourceDir -ExtractRoot $tempExtract
    $newVersion = "0.0.0"
    $versionFile = Join-Path $sourceDir "version.txt"
    if (Test-Path $versionFile) {
        $newVersion = (Get-Content $versionFile -Raw).Trim()
    }

    $localVersion = Get-LocalAgentVersion
    if ((Compare-AgentVersion $newVersion $localVersion) -le 0) {
        Write-UpdateLog "SKIP already at v$localVersion (server v$newVersion)"
        Register-HourlyUpdateTask -InstallDir $installDir
        if (-not $Silent) { Write-Host "Agent already up to date (v$localVersion)." -ForegroundColor Green }
    } else {
        Write-UpdateLog "Updating v$localVersion -> v$newVersion"

        foreach ($file in $AgentFiles) {
            $src = Join-Path $sourceDir $file
            if (Test-Path $src) {
                Copy-Item $src (Join-Path $installDir $file) -Force
            }
        }

        $heartbeatScript = Join-Path $installDir "office-heartbeat.ps1"
        Publish-AgentScriptTxt -Ps1Path $heartbeatScript | Out-Null
        Publish-AgentScriptTxt -Ps1Path (Join-Path $installDir "update.ps1") | Out-Null
        $vbsPath = New-HiddenRunner -ScriptPath $heartbeatScript -Dir $installDir

        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) {
            Refresh-ScheduledTask -VbsPath $vbsPath -InstallDir $installDir
            Write-UpdateLog "Refreshed scheduled task (did not stop running heartbeat)"
        }

        Register-HourlyUpdateTask -InstallDir $installDir
        Write-UpdateLog "Refreshed hourly update task"

        Write-UpdateLog "OK updated to v$newVersion"
        if (-not $Silent) {
            Write-Host "PwC Office Pulse updated to v$newVersion." -ForegroundColor Green
        }
    }
} catch {
    Write-UpdateLog "ERROR $($_.Exception.Message)"
    if (-not $Silent) { Write-Host "Update failed: $($_.Exception.Message)" -ForegroundColor Red }
    exit 1
} finally {
    Remove-Item $lockPath -Force -ErrorAction SilentlyContinue
    if ($tempZip -and (Test-Path $tempZip)) { Remove-Item $tempZip -Force -ErrorAction SilentlyContinue }
    if ($tempExtract -and (Test-Path $tempExtract)) { Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue }
}
