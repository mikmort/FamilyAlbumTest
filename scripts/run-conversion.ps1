# Wrapper script to set environment variables and run video conversion
$ErrorActionPreference = "Stop"

Write-Host "Loading credentials from local.settings.json..." -ForegroundColor Cyan

# Load settings
$settings = Get-Content "api\local.settings.json" | ConvertFrom-Json

# Set environment variables
$env:AZURE_STORAGE_ACCOUNT = $settings.Values.AZURE_STORAGE_ACCOUNT
$env:AZURE_STORAGE_KEY = $settings.Values.AZURE_STORAGE_KEY
$env:SQL_SERVER = $settings.Values.AZURE_SQL_SERVER
$env:SQL_DATABASE = $settings.Values.AZURE_SQL_DATABASE
$env:SQL_USER = $settings.Values.AZURE_SQL_USER
$env:SQL_PASSWORD = $settings.Values.AZURE_SQL_PASSWORD

Write-Host "Credentials loaded successfully" -ForegroundColor Green
Write-Host "Storage Account: $($env:AZURE_STORAGE_ACCOUNT)" -ForegroundColor Yellow
Write-Host ""

# Run conversion script with all arguments passed through
& .\scripts\convert-existing-videos.ps1 @args
