# My Office Pulse watchdog installer.
# This is the only script that creates or replaces the independent watchdog.
# Routine agent setup and updates must not modify an existing watchdog.

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not (Get-Variable -Name ReplaceExisting -Scope 0 -ErrorAction SilentlyContinue)) {
    $ReplaceExisting = $false
}
if (-not (Get-Variable -Name SourceDir -Scope 0 -ErrorAction SilentlyContinue)) {
    $SourceDir = $null
}

if ($null -ne $args -and $args.Count -gt 0) {
    for ($i = 0; $i -lt $args.Count; $i++) {
        switch ([string]$args[$i]) {
            "-SourceDir" {
                if ($i + 1 -lt $args.Count) { $SourceDir = [string]$args[$i + 1]; $i++ }
            }
            "-ReplaceExisting" { $ReplaceExisting = $true }
        }
    }
}

$TaskName = "PwCOfficePulseWatchdog"
$TaskDescription = "My Office Pulse - independent hourly agent recovery watchdog"
$InstallDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
$WatchdogDir = Join-Path $InstallDir "watchdog"
$LogDir = Join-Path $InstallDir "logs"
$LogPath = Join-Path $LogDir "watchdog-install.log"

function Write-WatchdogInstallLog([string]$Message) {
    if (-not (Test-Path -LiteralPath $LogDir)) {
        New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
    }
    Add-Content -LiteralPath $LogPath `
        -Value "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $Message" `
        -Encoding UTF8 -ErrorAction SilentlyContinue
}

function Resolve-WatchdogSourceDir {
    if ($SourceDir -and (Test-Path -LiteralPath $SourceDir)) {
        return [System.IO.Path]::GetFullPath($SourceDir)
    }
    if ($env:OFFICEPULSE_WATCHDOG_SOURCE -and
        (Test-Path -LiteralPath $env:OFFICEPULSE_WATCHDOG_SOURCE)) {
        return [System.IO.Path]::GetFullPath($env:OFFICEPULSE_WATCHDOG_SOURCE)
    }
    if ($PSScriptRoot -and (Test-Path -LiteralPath $PSScriptRoot)) {
        return [System.IO.Path]::GetFullPath($PSScriptRoot)
    }
    if ($env:OFFICEPULSE_SETUP_ROOT) {
        $candidate = Join-Path $env:OFFICEPULSE_SETUP_ROOT "watchdog"
        if (Test-Path -LiteralPath $candidate) {
            return [System.IO.Path]::GetFullPath($candidate)
        }
    }
    throw "Watchdog source directory not found"
}

function Copy-WatchdogFile {
    param([string]$Source, [string]$Destination)
    $sourceFull = [System.IO.Path]::GetFullPath($Source)
    $destinationFull = [System.IO.Path]::GetFullPath($Destination)
    if ($sourceFull -ieq $destinationFull) { return }
    Copy-Item -LiteralPath $Source -Destination $Destination -Force
    Unblock-File -LiteralPath $Destination -ErrorAction SilentlyContinue
}

try {
    $existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existingTask -and -not $ReplaceExisting) {
        Write-WatchdogInstallLog "SKIP existing watchdog left unchanged"
        exit 0
    }

    $source = Resolve-WatchdogSourceDir
    $watchdogSource = Join-Path $source "watchdog.ps1"
    $runnerSource = Join-Path $source "run-watchdog.vbs"
    $installerSource = Join-Path $source "install-watchdog.ps1"
    foreach ($required in @($watchdogSource, $runnerSource)) {
        if (-not (Test-Path -LiteralPath $required)) {
            throw "Required watchdog file missing: $required"
        }
    }

    if (-not (Test-Path -LiteralPath $WatchdogDir)) {
        New-Item -ItemType Directory -Path $WatchdogDir -Force | Out-Null
    }
    Copy-WatchdogFile -Source $watchdogSource `
        -Destination (Join-Path $WatchdogDir "watchdog.ps1")
    Copy-WatchdogFile -Source $runnerSource `
        -Destination (Join-Path $WatchdogDir "run-watchdog.vbs")
    if (Test-Path -LiteralPath $installerSource) {
        Copy-WatchdogFile -Source $installerSource `
            -Destination (Join-Path $WatchdogDir "install-watchdog.ps1")
    }

    $runner = Join-Path $WatchdogDir "run-watchdog.vbs"
    $wscript = (Get-Command wscript.exe -ErrorAction Stop).Source
    if (-not $wscript) { throw "wscript.exe path not found" }

    $action = New-ScheduledTaskAction -Execute $wscript `
        -Argument "//B //Nologo `"$runner`""
    $hourly = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
        -RepetitionInterval (New-TimeSpan -Hours 1) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $logon = New-ScheduledTaskTrigger -AtLogOn
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
        -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries `
        -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew

    try {
        Register-ScheduledTask -TaskName $TaskName -Action $action `
            -Trigger @($hourly, $logon) -Principal $principal -Settings $settings `
            -Description $TaskDescription -Force | Out-Null
    } catch {
        Register-ScheduledTask -TaskName $TaskName -Action $action `
            -Trigger $hourly -Principal $principal -Settings $settings `
            -Description $TaskDescription -Force | Out-Null
    }

    Write-WatchdogInstallLog "OK installed independent watchdog (hourly + logon when supported)"
    exit 0
} catch {
    Write-WatchdogInstallLog "ERROR $($_.Exception.Message)"
    exit 1
}
