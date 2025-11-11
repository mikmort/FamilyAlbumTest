# Start Azure Functions local server in background
# Usage: .\scripts\start-local-api.ps1

Write-Host "Starting Azure Functions local server..." -ForegroundColor Cyan

# Check if already running
$existingFunc = Get-Process -Name "func" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*azure-functions-core-tools*"
}

if ($existingFunc) {
    Write-Host "Azure Functions is already running (PID: $($existingFunc.Id))" -ForegroundColor Yellow
    Write-Host "To stop it, run: Stop-Process -Id $($existingFunc.Id) -Force" -ForegroundColor Yellow
    exit 0
}

# Start func in a new process
$apiPath = Join-Path $PSScriptRoot "..\api"
Start-Process -FilePath "func" -ArgumentList "start" -WorkingDirectory $apiPath -WindowStyle Normal

Start-Sleep -Seconds 3

# Verify it started
$funcProcess = Get-Process -Name "func" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*azure-functions-core-tools*"
}

if ($funcProcess) {
    Write-Host "✓ Azure Functions started successfully (PID: $($funcProcess.Id))" -ForegroundColor Green
    Write-Host "  Listening on: http://localhost:7071" -ForegroundColor Cyan
    Write-Host "  To stop: Stop-Process -Id $($funcProcess.Id) -Force" -ForegroundColor Yellow
} else {
    Write-Host "✗ Failed to start Azure Functions" -ForegroundColor Red
    exit 1
}
