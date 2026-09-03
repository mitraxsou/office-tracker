# Export PwC SSL inspection CA chain for Node (Vercel CLI, npm, etc.).
# Run once per machine (re-run if IT rotates proxy certs).
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$outDir = Join-Path $repoRoot ".certs"
$pemPath = Join-Path $outDir "pwc-proxy.pem"

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$tcp = New-Object System.Net.Sockets.TcpClient("api.vercel.com", 443)
$ssl = New-Object System.Net.Security.SslStream($tcp.GetStream(), $false, ({ $true }))
$ssl.AuthenticateAsClient("api.vercel.com")

$chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain
$chain.ChainPolicy.RevocationMode = [System.Security.Cryptography.X509Certificates.X509RevocationMode]::NoCheck
[void]$chain.Build($ssl.RemoteCertificate)

$pem = @()
for ($i = 1; $i -lt $chain.ChainElements.Count; $i++) {
    $cert = $chain.ChainElements[$i].Certificate
    $pem += "-----BEGIN CERTIFICATE-----"
    $pem += [Convert]::ToBase64String($cert.RawData, "InsertLineBreaks")
    $pem += "-----END CERTIFICATE-----"
    Write-Host "Captured: $($cert.Subject)"
}

$pem -join "`n" | Set-Content -Encoding ascii $pemPath
$ssl.Close()
$tcp.Close()

Write-Host ""
Write-Host "Wrote $pemPath"
Write-Host "Set for this session:"
Write-Host "  `$env:NODE_EXTRA_CA_CERTS = `"$pemPath`""
Write-Host ""
Write-Host "Optional (persistent): Windows user env var NODE_EXTRA_CA_CERTS = above path"
