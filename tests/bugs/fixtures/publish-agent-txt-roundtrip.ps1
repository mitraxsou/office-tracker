# Validates Publish-AgentScriptTxt UTF-8 round-trip and that shipping heartbeat .txt parses.
# Exit 0 = OK. Non-zero = fleet-breaking regression.
$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
$agentDir = Join-Path $repoRoot "agent"
$downloadModule = Join-Path $agentDir "lib\agent-download.ps1"
$heartbeatPs1 = Join-Path $agentDir "office-heartbeat.ps1"

. $downloadModule

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("ot-bug017-" + [Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
try {
  $samplePs1 = Join-Path $tempDir "sample.ps1"
  $acute = [char]0x00E9
  $sampleBody = "`$msg = `"caf$acute`"`nWrite-Output `$msg"
  Set-Content -LiteralPath $samplePs1 -Value $sampleBody -Encoding UTF8

  $txt = Publish-AgentScriptTxt -Ps1Path $samplePs1
  $published = Get-Content -LiteralPath $txt -Raw -Encoding UTF8
  if ($published.IndexOf($acute) -lt 0) {
    Write-Error "UTF-8 round-trip lost non-ASCII character (Publish-AgentScriptTxt encoding regression)"
    exit 2
  }

  $hbTxt = Publish-AgentScriptTxt -Ps1Path $heartbeatPs1
  $errs = $null
  $tokens = $null
  $raw = Get-Content -LiteralPath $hbTxt -Raw -Encoding UTF8
  $null = [System.Management.Automation.Language.Parser]::ParseInput($raw, [ref]$tokens, [ref]$errs)
  if ($errs -and $errs.Count -gt 0) {
    Write-Error ("office-heartbeat.txt does not parse after Publish-AgentScriptTxt: " + $errs[0].ToString())
    exit 3
  }

  Write-Output "BUG017_OK"
  exit 0
}
finally {
  Remove-Item -LiteralPath $tempDir -Recurse -Force -ErrorAction SilentlyContinue
}
