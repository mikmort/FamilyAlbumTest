# Stop Azure Functions local server
# Usage: .\scripts\stop-local-api.ps1

Write-Host "Stopping Azure Functions local server..." -ForegroundColor Cyan

$funcProcesses = Get-Process -Name "func","node" -ErrorAction SilentlyContinue | Where-Object {
    $_.Path -like "*azure-functions-core-tools*" -or
    $_.Path -like "*FamilyAlbumTest\api*"
}

if ($funcProcesses) {
    foreach ($proc in $funcProcesses) {
        Write-Host "Stopping process: $($proc.ProcessName) (PID: $($proc.Id))" -ForegroundColor Yellow
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    
    Start-Sleep -Seconds 2
    
    # Verify stopped
    $stillRunning = Get-Process -Name "func" -ErrorAction SilentlyContinue | Where-Object {
        $_.Path -like "*azure-functions-core-tools*"
    }
    
    if ($stillRunning) {
        Write-Host "✗ Some processes are still running" -ForegroundColor Red
    } else {
        Write-Host "✓ Azure Functions stopped successfully" -ForegroundColor Green
    }
} else {
    Write-Host "No Azure Functions processes found" -ForegroundColor Yellow
}
