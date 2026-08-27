# PwC Office Pulse installer. No admin required by default.
#
# Installs to:  %LOCALAPPDATA%\OfficeTracker\
# Scheduled:   PwCOfficePulse task every 2 minutes (hidden via VBS wrapper)
# Startup:     shortcut in user Startup folder
#
# Usage:
#   .\install.ps1 -ApiUrl "https://your-app.vercel.app" -Token "your-agent-token-from-settings"

param(
    [Parameter(Mandatory = $true)]
    [string]$ApiUrl,

    [Parameter(Mandatory = $true)]
    [string]$Token,

    [switch]$RequireAdmin
)

$ErrorActionPreference = "Stop"
$TaskName = "PwCOfficePulse"
$TaskDescription = "PwC Office Pulse - office hours tracker"
$LegacyTaskNames = @("OfficeTrackerHeartbeat", "PwCOfficePulse")

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
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

function New-HiddenRunner {
    param(
        [string]$ScriptPath,
        [string]$Dir
    )
    $vbsPath = Join-Path $Dir "run-heartbeat.vbs"
    $vbsContent = @"
CreateObject("Wscript.Shell").Run "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$ScriptPath""", 0, False
"@
    Set-Content -Path $vbsPath -Value $vbsContent -Encoding ASCII
    return $vbsPath
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
    $trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
        -RepetitionInterval (New-TimeSpan -Minutes 2) `
        -RepetitionDuration (New-TimeSpan -Days 3650)
    $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME `
        -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -MultipleInstances IgnoreNew

    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger `
        -Principal $principal -Settings $settings -Description $TaskDescription -Force | Out-Null

    $startupDir = [Environment]::GetFolderPath("Startup")
    foreach ($legacy in @("OfficeTrackerHeartbeat.lnk", "PwC Office Pulse.lnk")) {
        $legacyPath = Join-Path $startupDir $legacy
        if (Test-Path $legacyPath) { Remove-Item $legacyPath -Force }
    }

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

function Install-UserLevel {
    $installDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
    $scriptDir = $PSScriptRoot

    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    Copy-Item (Join-Path $scriptDir "office-heartbeat.ps1") (Join-Path $installDir "office-heartbeat.ps1") -Force
    Copy-Item (Join-Path $scriptDir "update.ps1") (Join-Path $installDir "update.ps1") -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $scriptDir "uninstall.ps1") (Join-Path $installDir "uninstall.ps1") -Force -ErrorAction SilentlyContinue

    $serial = Get-LaptopSerial
    $config = @{
        apiUrl = $ApiUrl.TrimEnd("/")
        token  = $Token
    }
    if ($serial) { $config.serialNumber = $serial }
    ($config | ConvertTo-Json) | Set-Content -Path (Join-Path $installDir "config.json") -Encoding UTF8

    $heartbeatScript = Join-Path $installDir "office-heartbeat.ps1"
    $vbsPath = New-HiddenRunner -ScriptPath $heartbeatScript -Dir $installDir
    Register-HiddenTask -VbsPath $vbsPath -InstallDir $installDir

    Write-Host ""
    Write-Host "PwC Office Pulse installed (user-level)" -ForegroundColor Green
    Write-Host "Install dir:     $installDir"
    Write-Host "Scheduled task:  $TaskName (hidden, every 2 min)"
    Write-Host "Startup shortcut: PwC Office Pulse.lnk"
    Write-Host "Config:          $(Join-Path $installDir 'config.json')"
    Write-Host ""
    Write-Host "Test:  powershell -ExecutionPolicy Bypass -File `"$heartbeatScript`" -DryRun"
}

function Install-AdminLevel {
    if (-not (Test-IsAdmin)) {
        Write-Host "Re-launching with admin (UAC prompt)..." -ForegroundColor Yellow
        $args = @(
            "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $PSCommandPath,
            "-ApiUrl", $ApiUrl, "-Token", $Token, "-RequireAdmin"
        )
        Start-Process powershell.exe -Verb RunAs -ArgumentList $args
        exit 0
    }

    $installDir = "C:\Program Files\OfficeTracker"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    Copy-Item (Join-Path $PSScriptRoot "office-heartbeat.ps1") (Join-Path $installDir "office-heartbeat.ps1") -Force
    Copy-Item (Join-Path $PSScriptRoot "update.ps1") (Join-Path $installDir "update.ps1") -Force -ErrorAction SilentlyContinue
    Copy-Item (Join-Path $PSScriptRoot "uninstall.ps1") (Join-Path $installDir "uninstall.ps1") -Force -ErrorAction SilentlyContinue

    $localConfigDir = Join-Path $env:LOCALAPPDATA "OfficeTracker"
    if (-not (Test-Path $localConfigDir)) { New-Item -ItemType Directory -Path $localConfigDir -Force | Out-Null }
    $config = @{ apiUrl = $ApiUrl.TrimEnd("/"); token = $Token } | ConvertTo-Json
    Set-Content -Path (Join-Path $localConfigDir "config.json") -Value $config -Encoding UTF8

    $heartbeatScript = Join-Path $installDir "office-heartbeat.ps1"
    $vbsPath = New-HiddenRunner -ScriptPath $heartbeatScript -Dir $localConfigDir
    Register-HiddenTask -VbsPath $vbsPath -InstallDir $localConfigDir

    Write-Host ""
    Write-Host "PwC Office Pulse installed (admin / Program Files)" -ForegroundColor Green
    Write-Host "Scripts:  $installDir"
    Write-Host "Config:   $(Join-Path $localConfigDir 'config.json')"
}

Write-Host "PwC Office Pulse installer"
Write-Host "Admin required: NO (default user-level install)"
Write-Host ""

if ($RequireAdmin) {
    Install-AdminLevel
} else {
    Install-UserLevel
}
