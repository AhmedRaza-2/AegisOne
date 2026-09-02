@echo off
echo Installing AegisOne E2E Simulation dependencies...
cd /d "d:\Coding Projects\AegisOne\e2e-simulation"
npm install
if errorlevel 1 (
    echo npm install failed!
    exit /b 1
)
echo.
echo Installing Playwright browsers...
npx playwright install chromium
echo.
echo Done! Run the simulation with:
echo   npm run simulate
echo.
pause
