# AegisOne Server Startup Script
# Automatically detects Wi-Fi IP and exposes Landing (3000), Dashboard (3002), and Backend (8000)

Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "         🚀 AegisOne Multi-Device Server Start        " -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Detect Wi-Fi IP address
$wifiIP = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" -ErrorAction SilentlyContinue).IPAddress

if (-not $wifiIP) {
    # Fallback to first non-loopback IPv4 address
    $wifiIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } | Select-Object -ExpandProperty IPAddress -First 1)
}

if (-not $wifiIP) {
    $wifiIP = "127.0.0.1"
}

Write-Host "[+] Detected Server Local IP: $wifiIP" -ForegroundColor Green

# Ensure Windows Firewall rules exist for AegisOne ports
Write-Host "[+] Ensuring Windows Firewall rules for ports 3000, 3002, 8000..." -ForegroundColor Yellow
try {
    $existingRule = Get-NetFirewallRule -DisplayName "AegisOne Server Ports" -ErrorAction SilentlyContinue
    if (-not $existingRule) {
        New-NetFirewallRule -DisplayName "AegisOne Server Ports" -Direction Inbound -LocalPort 3000,3002,8000,5432 -Protocol TCP -Action Allow | Out-Null
        Write-Host "[+] Firewall rules successfully created!" -ForegroundColor Green
    } else {
        Write-Host "[+] Firewall rules already active." -ForegroundColor Green
    }
} catch {
    Write-Host "[!] Note: Run script as Admin if firewall block occurs." -ForegroundColor Yellow
}

# Export SERVER_HOST for Docker Compose
$env:SERVER_HOST = $wifiIP
$env:AEGIS_DASHBOARD_URL = "http://${wifiIP}:3002"

Write-Host "[+] Starting AegisOne Docker stack..." -ForegroundColor Green
docker compose down
docker compose up --build -d

Write-Host ""
Write-Host "======================================================" -ForegroundColor Green
Write-Host " 🎉 AegisOne is live on your Local Wi-Fi network!     " -ForegroundColor Green
Write-Host "======================================================" -ForegroundColor Green
Write-Host " Share these links with other laptops on the Wi-Fi:" -ForegroundColor White
Write-Host ""
Write-Host " 🌐 Landing Page:       http://${wifiIP}:3000" -ForegroundColor Cyan
Write-Host " 📊 Dashboard Portal:   http://${wifiIP}:3002" -ForegroundColor Cyan
Write-Host " ⚡ Backend API Docs:   http://${wifiIP}:8000/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host " 🔌 Chrome Extension Server URL: http://${wifiIP}:8000" -ForegroundColor Yellow
Write-Host "======================================================" -ForegroundColor Green
