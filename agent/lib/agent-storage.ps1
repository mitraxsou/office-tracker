# Local agent storage maintenance: log rotation and event-queue bounds.
# Dot-source from office-heartbeat.ps1 and setup.ps1.

$script:AgentLogMaxTotalBytes = 10 * 1024 * 1024
$script:AgentLogTrimTargetBytes = 7 * 1024 * 1024
$script:AgentLogFileTrimBytes = 2 * 1024 * 1024

# Bound for ~7 days of 2-minute ticks plus critical events before overflow prune.
$script:AgentEventQueueMaxCount = 5500
$script:AgentEventQueueMaxBytes = 4 * 1024 * 1024
$script:AgentStaleEventDays = 7

$script:AgentCriticalEventTypes = @(
    "visit_start",
    "visit_end",
    "daily_summary",
    "hours_target_met",
    "session_suspend",
    "session_resume",
    "wifi_connected",
    "wifi_disconnected",
    "ssid_changed"
)
$script:AgentExpendableEventTypes = @(
    "health_ping",
    "activity_tick"
)

function Get-AgentInstallDir {
    if ($env:OFFICETRACKER_INSTALL_DIR) {
        return [string]$env:OFFICETRACKER_INSTALL_DIR
    }
    Join-Path $env:LOCALAPPDATA "OfficeTracker"
}

function Get-AgentLogDirectory {
    Join-Path (Get-AgentInstallDir) "logs"
}

function Get-DirectorySizeBytes {
    param([string]$Dir)
    if (-not (Test-Path -LiteralPath $Dir)) { return [long]0 }
    $sum = [long]0
    Get-ChildItem -LiteralPath $Dir -File -ErrorAction SilentlyContinue | ForEach-Object {
        $sum += $_.Length
    }
    return $sum
}

function Invoke-TruncateLogFileTail {
    param(
        [string]$Path,
        [long]$KeepBytes
    )
    if (-not (Test-Path -LiteralPath $Path)) { return [long]0 }
    $item = Get-Item -LiteralPath $Path
    if ($item.Length -le $KeepBytes) { return [long]0 }

    $removed = [long]0
    $fs = $null
    try {
        $fs = [System.IO.File]::Open(
            $Path,
            [System.IO.FileMode]::Open,
            [System.IO.FileAccess]::Read,
            [System.IO.FileShare]::ReadWrite
        )
        $start = [Math]::Max([long]0, $fs.Length - $KeepBytes)
        $readLen = [int]($fs.Length - $start)
        $fs.Seek($start, [System.IO.FileSeekOrigin]::Begin) | Out-Null
        $buffer = New-Object byte[] $readLen
        [void]$fs.Read($buffer, 0, $readLen)
        $text = [System.Text.Encoding]::UTF8.GetString($buffer)
        $firstNewline = $text.IndexOf("`n")
        if ($firstNewline -ge 0) {
            $text = $text.Substring($firstNewline + 1)
        }
        $header = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') LOG truncated; kept last $KeepBytes bytes`n"
        $newContent = $header + $text
        Set-Content -LiteralPath $Path -Value $newContent -Encoding UTF8
        $removed = $item.Length - [System.Text.Encoding]::UTF8.GetByteCount($newContent)
        if ($removed -lt 0) { $removed = $item.Length }
    } finally {
        if ($fs) { $fs.Dispose() }
    }
    return $removed
}

function Invoke-AgentLogMaintenance {
    param(
        [scriptblock]$Log = { param($m) }
    )

    $logDir = Get-AgentLogDirectory
    if (-not (Test-Path -LiteralPath $logDir)) { return }

    $total = Get-DirectorySizeBytes -Dir $logDir
    if ($total -le $script:AgentLogMaxTotalBytes) { return }

    & $Log "MAINTENANCE logs ${total}B exceed $($script:AgentLogMaxTotalBytes)B; trimming"

    $files = @(Get-ChildItem -LiteralPath $logDir -File -Filter "*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime)
    foreach ($file in $files) {
        if ($file.Length -gt $script:AgentLogFileTrimBytes) {
            $removed = Invoke-TruncateLogFileTail -Path $file.FullName -KeepBytes $script:AgentLogFileTrimBytes
            if ($removed -gt 0) {
                & $Log "MAINTENANCE truncated $($file.Name) removed ${removed}B"
            }
        }
    }

    $total = Get-DirectorySizeBytes -Dir $logDir
    while ($total -gt $script:AgentLogTrimTargetBytes -and $files.Count -gt 0) {
        $target = $files | Sort-Object Length -Descending | Select-Object -First 1
        if (-not $target) { break }
        if ($target.Length -gt 64 * 1024) {
            $removed = Invoke-TruncateLogFileTail -Path $target.FullName -KeepBytes 256 * 1024
            if ($removed -le 0) { break }
            & $Log "MAINTENANCE truncated $($target.Name) again removed ${removed}B"
        } else {
            Remove-Item -LiteralPath $target.FullName -Force -ErrorAction SilentlyContinue
            & $Log "MAINTENANCE deleted $($target.Name)"
            $files = @($files | Where-Object { $_.FullName -ne $target.FullName })
        }
        $total = Get-DirectorySizeBytes -Dir $logDir
    }
}

function Test-AgentEventIsCritical {
    param($Event)
    return $script:AgentCriticalEventTypes -contains [string]$Event.type
}

function Get-AgentEventAgeDays {
    param($Event)
    try {
        $at = [DateTime]::Parse([string]$Event.at)
        return ((Get-Date).ToUniversalTime() - $at.ToUniversalTime()).TotalDays
    } catch {
        return 0
    }
}

function Get-AgentEventQueuePayloadBytes {
    param([array]$Events)
    try {
        $json = (@{ events = $Events } | ConvertTo-Json -Depth 8 -Compress)
        return [System.Text.Encoding]::UTF8.GetByteCount($json)
    } catch {
        return [long]::MaxValue
    }
}

function Invoke-PruneAgentEventQueue {
    param([array]$Events)

    if (-not $Events -or $Events.Count -eq 0) {
        return @{ events = @(); removedStale = 0; removedOverflow = 0 }
    }

    $kept = [System.Collections.ArrayList]@()
    $removedStale = 0
    foreach ($evt in $Events) {
        $type = [string]$evt.type
        $ageDays = Get-AgentEventAgeDays -Event $evt
        if ($script:AgentExpendableEventTypes -contains $type -and $ageDays -gt $script:AgentStaleEventDays) {
            $removedStale++
            continue
        }
        [void]$kept.Add($evt)
    }

    $working = @($kept.ToArray())
    $removedOverflow = 0
    while (
        $working.Count -gt $script:AgentEventQueueMaxCount -or
        (Get-AgentEventQueuePayloadBytes -Events $working) -gt $script:AgentEventQueueMaxBytes
    ) {
        $expendable = @(
            $working |
                Where-Object { $script:AgentExpendableEventTypes -contains [string]$_.type } |
                Sort-Object { Get-AgentEventAgeDays -Event $_ }
        )
        if ($expendable.Count -eq 0) { break }
        $dropId = [string]$expendable[0].id
        $working = @($working | Where-Object { [string]$_.id -ne $dropId })
        $removedOverflow++
    }

    return @{
        events = $working
        removedStale = $removedStale
        removedOverflow = $removedOverflow
    }
}

function Invoke-AgentStorageMaintenance {
    param(
        [scriptblock]$Log = { param($m) },
        [array]$Events = @(),
        [switch]$SkipEventQueue
    )

    Invoke-AgentLogMaintenance -Log $Log

    if ($SkipEventQueue) { return @{ events = $Events } }

    $result = Invoke-PruneAgentEventQueue -Events $Events
    if ($result.removedStale -gt 0 -or $result.removedOverflow -gt 0) {
        & $Log "MAINTENANCE event queue pruned stale=$($result.removedStale) overflow=$($result.removedOverflow) remaining=$($result.events.Count)"
    }

    return @{ events = @($result.events) }
}
