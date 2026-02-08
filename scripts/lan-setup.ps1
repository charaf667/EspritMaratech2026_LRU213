# ─── OMNIA LAN Setup ──────────────────────────────────────
# Run this script when you change Wi-Fi to auto-configure LAN testing.
# Usage: .\scripts\lan-setup.ps1
# ──────────────────────────────────────────────────────────

$ROOT = Split-Path $PSScriptRoot -Parent

# 1. Detect Wi-Fi IP
$ip = (Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4 -ErrorAction SilentlyContinue).IPAddress
if (-not $ip) {
    # Fallback: try any non-VMware, non-loopback IPv4
    $ip = (Get-NetIPAddress -AddressFamily IPv4 |
        Where-Object { $_.IPAddress -notlike '169.*' -and $_.IPAddress -ne '127.0.0.1' -and $_.InterfaceAlias -notlike 'VMware*' } |
        Select-Object -First 1).IPAddress
}
if (-not $ip) {
    Write-Host "ERROR: No Wi-Fi IP found. Connect to Wi-Fi first." -ForegroundColor Red
    exit 1
}

Write-Host "Wi-Fi IP detected: $ip" -ForegroundColor Green

# 2. Update .env (root)
$envFile = Join-Path $ROOT ".env"
if (Test-Path $envFile) {
    $content = Get-Content $envFile -Raw
    # Replace any IP:port pattern in CORS/CSRF/WEBAUTHN lines
    $content = $content -replace '(CORS_ALLOWED_ORIGINS=.*localhost:\d+),http://[\d.]+:\d+', "`$1,http://${ip}:3000"
    $content = $content -replace '(CSRF_TRUSTED_ORIGINS=.*localhost:\d+),http://[\d.]+:\d+', "`$1,http://${ip}:3000"
    $content = $content -replace '(WEBAUTHN_ORIGIN=.*localhost:\d+),http://[\d.]+:\d+', "`$1,http://${ip}:3000"
    # If no LAN IP yet, append it
    if ($content -notmatch "${ip}") {
        $content = $content -replace '(CORS_ALLOWED_ORIGINS=http://localhost:3000)$', "`$1,http://${ip}:3000"
        $content = $content -replace '(CSRF_TRUSTED_ORIGINS=http://localhost:3000)$', "`$1,http://${ip}:3000"
    }
    Set-Content $envFile $content -NoNewline
    Write-Host "Updated .env with LAN IP" -ForegroundColor Cyan
}

# 3. Update apps/web/.env.local
$webEnv = Join-Path $ROOT "apps\web\.env.local"
if (Test-Path $webEnv) {
    $content = Get-Content $webEnv -Raw
    $content = $content -replace 'NEXT_PUBLIC_API_BASE_URL=http://[\d.]+:\d+', "NEXT_PUBLIC_API_BASE_URL=http://${ip}:8000"
    Set-Content $webEnv $content -NoNewline
    Write-Host "Updated apps/web/.env.local with LAN IP" -ForegroundColor Cyan
}

# 4. Summary
Write-Host ""
Write-Host "=== Ready ===" -ForegroundColor Green
Write-Host "iPhone Safari  : http://${ip}:3000" -ForegroundColor Yellow
Write-Host "Django API     : http://${ip}:8000" -ForegroundColor Yellow
Write-Host ""
Write-Host "Now restart your servers:" -ForegroundColor White
Write-Host "  Terminal 1: cd apps/api && python manage.py runserver 0.0.0.0:8000"
Write-Host "  Terminal 2: cd apps/web && npx next dev --hostname 0.0.0.0 --port 3000"
