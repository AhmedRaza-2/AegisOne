$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

function Start-ServiceWindow {
    param(
        [string]$Title,
        [string]$WorkingDirectory,
        [string]$Command
    )

    $encodedCommand = @"
Set-Location -LiteralPath '$WorkingDirectory'
Write-Host 'Starting $Title...'
$Command
"@

    Start-Process powershell.exe -ArgumentList @(
        "-NoExit",
        "-ExecutionPolicy", "Bypass",
        "-Command", $encodedCommand
    ) -WorkingDirectory $WorkingDirectory | Out-Null
}

Start-ServiceWindow `
    -Title "AegisOne Backend" `
    -WorkingDirectory $root `
    -Command "uvicorn api.main:app --reload --host 0.0.0.0 --port 8000"

Start-ServiceWindow `
    -Title "AegisOne Landing" `
    -WorkingDirectory (Join-Path $root "frontend\landing") `
    -Command "npm run dev"

Start-ServiceWindow `
    -Title "AegisOne Setup" `
    -WorkingDirectory (Join-Path $root "frontend\setup") `
    -Command "npm run dev"

Start-ServiceWindow `
    -Title "AegisOne Dashboard" `
    -WorkingDirectory (Join-Path $root "frontend\dashboard") `
    -Command "npm run dev"

Write-Host "Launched backend + 3 frontends in separate PowerShell windows."
