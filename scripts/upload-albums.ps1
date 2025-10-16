# Quick Upload Script for Family Album - Albums Directory
# This script uploads photos from E:\Family Album\Albums to your Family Album application

Write-Host "=== Family Album Quick Upload ===" -ForegroundColor Green
Write-Host "This will upload photos from E:\Family Album\Albums" -ForegroundColor Cyan
Write-Host ""

# Source directory
$sourceDir = "E:\Family Album\Albums"

# Check if directory exists
if (-not (Test-Path $sourceDir)) {
    Write-Error "Directory not found: $sourceDir"
    Write-Host "Please make sure the directory exists and try again." -ForegroundColor Yellow
    exit 1
}

# Get the main script path
$scriptPath = Join-Path $PSScriptRoot "bulk-upload-photos.ps1"

# Check if Azure Functions is running
Write-Host "Checking if Azure Functions API is running..." -ForegroundColor Yellow
try {
    # Try to connect to the people endpoint which accepts GET
    $response = Invoke-WebRequest -Uri "http://localhost:7071/api/people" -Method Get -TimeoutSec 5 -ErrorAction Stop
    Write-Host "API is running" -ForegroundColor Green
} catch {
    # Check if it's just a connection error or if the server isn't running
    if ($_.Exception.Message -like "*Unable to connect*" -or $_.Exception.Message -like "*No connection could be made*") {
        Write-Host ""
        Write-Host "WARNING: Azure Functions API is not running!" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please start the API first by running:" -ForegroundColor Yellow
        Write-Host "  cd api" -ForegroundColor Cyan
        Write-Host "  npm start" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Then run this script again." -ForegroundColor Yellow
        exit 1
    } else {
        # Other errors (like 401, 500) mean the server is running
        Write-Host "API is running (received response)" -ForegroundColor Green
    }
}

Write-Host ""

# Run the bulk upload script
& $scriptPath -SourceDirectory $sourceDir -ApiEndpoint "http://localhost:7071/api/upload"
