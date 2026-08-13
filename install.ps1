# ──────────────────────────────────────────────────────────────────────────────
# AegisOne One-Click Client Deployment Script (Windows PowerShell)
# ──────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "                AEGISONE ENTERPRISE DEPLOYMENT SETUP                  " -ForegroundColor HighContrastWhite
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Define Target Installation Directory
$installDir = Join-Path $env:USERPROFILE "AegisOne"
if (!(Test-Path $installDir)) {
    New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    Write-Host "[+] Created installation folder: $installDir" -ForegroundColor Green
} else {
    Write-Host "[*] Using installation folder: $installDir" -ForegroundColor Yellow
}

Set-Location $installDir

# 2. Get Credentials if not set in environment
if (-not $env:ORG_ID) {
    $env:ORG_ID = Read-Host "[?] Enter Organization ID (e.g. LVP755)"
}
if (-not $env:LICENSE_KEY) {
    $env:LICENSE_KEY = Read-Host "[?] Enter License Key (e.g. G4JH-OOLA-GJHT-VHMC)"
}
if (-not $env:DEPLOYMENT_TOKEN) {
    $env:DEPLOYMENT_TOKEN = Read-Host "[?] Enter Deployment Token (e.g. JKVO5-02X4C-E5YC4)"
}
if (-not $env:ADMIN_EMAIL) {
    $env:ADMIN_EMAIL = Read-Host "[?] Enter Admin Email (e.g. admin@company.com)"
}

# 3. Create docker-compose.yml dynamically
$dockerComposeContent = @"
services:
  db:
    image: postgres:16-alpine
    container_name: aegisone-db
    environment:
      POSTGRES_DB: aegisone
      POSTGRES_USER: aegis
      POSTGRES_PASSWORD: `${DB_PASSWORD:-aegisone_secret}
    volumes:
      - aegisone-pg-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U aegis -d aegisone"]
      interval: 5s
      timeout: 5s
      retries: 10
    restart: unless-stopped

  backend:
    image: python:3.11-slim
    container_name: aegisone-backend
    command: ["uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "8000"]
    environment:
      AEGIS_PORT: "8000"
      AEGIS_WORKERS: "1"
      AEGIS_DATABASE_URL: "postgresql+asyncpg://aegis:`${DB_PASSWORD:-aegisone_secret}@db:5432/aegisone"
      AEGIS_JWT_SECRET: `${AEGIS_JWT_SECRET:-change-me-in-production}
      AEGIS_DASHBOARD_URL: `${AEGIS_DASHBOARD_URL:-http://localhost:3002}
      ORG_ID: "${env:ORG_ID}"
      LICENSE_KEY: "${env:LICENSE_KEY}"
      DEPLOYMENT_TOKEN: "${env:DEPLOYMENT_TOKEN}"
      ADMIN_EMAIL: "${env:ADMIN_EMAIL}"
      OLLAMA_API_KEY: "${env:OLLAMA_API_KEY}"
    ports:
      - "8000:8000"
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped

volumes:
  aegisone-pg-data:
"@

Set-Content -Path "$installDir\docker-compose.yml" -Value $dockerComposeContent
Write-Host "[+] Prepared docker-compose.yml configuration." -ForegroundColor Green

# 4. Stop existing containers & Start new services
Write-Host "[*] Initializing AegisOne Docker containers..." -ForegroundColor Yellow
docker compose down --remove-orphans 2>$null
docker compose up -d --remove-orphans

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "         AEGISONE DEPLOYED SUCCESSFULLY & RUNNING IN BACKGROUND!      " -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  Backend API:        http://localhost:8000" -ForegroundColor Cyan
Write-Host "  Setup Wizard:       http://localhost:3001" -ForegroundColor Cyan
Write-Host "  Admin Dashboard:    http://localhost:3002" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Green
Write-Host ""
