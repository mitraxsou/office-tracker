' My Office Pulse watchdog runner. Uses -File watchdog.ps1 (isolated from heartbeat IEX).
Option Explicit
Dim sh, ps1, cmd
Set sh = CreateObject("Wscript.Shell")
ps1 = sh.ExpandEnvironmentStrings("%LOCALAPPDATA%\OfficeTracker\watchdog\watchdog.ps1")
cmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """"
sh.Run cmd, 0, False
