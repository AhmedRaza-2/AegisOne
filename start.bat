@echo off
:: AegisOne 1-Click Docker Launcher for Windows (CMD & PowerShell)
echo ========================================================
echo          AegisOne Security Suite Docker Start
echo ========================================================

:: Set default environment variables if not already set
if "%ORG_ID%"=="" set ORG_ID=LVP755
if "%LICENSE_KEY%"=="" set LICENSE_KEY=G4JH-OOLA-GJHT-VHMC
if "%DEPLOYMENT_TOKEN%"=="" set DEPLOYMENT_TOKEN=JKVO5-02X4C-E5YC4
if "%ADMIN_EMAIL%"=="" set ADMIN_EMAIL=araza2125012.pgc@gmail.com

echo Stopping old containers...
docker compose down --remove-orphans

echo Building images and starting AegisOne services...
docker compose up -d --build --remove-orphans

echo.
echo ========================================================
echo  ✓ AegisOne is running!
echo  • Backend API:      http://localhost:8000
echo  • Admin Dashboard:  http://localhost:3000
echo  • Setup Wizard:     http://localhost:3001
echo ========================================================
pause
