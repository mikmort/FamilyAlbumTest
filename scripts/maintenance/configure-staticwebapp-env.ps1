# Configure Azure Static Web App Environment Variables
# This script adds the required environment variables for Azure Storage and SQL Database

param(
    [string]$ResourceGroup = "familyalbum-prod-rg",
    [string]$AppName = "lively-glacier-02a77180f",
    [Parameter(Mandatory=$true)]
    [string]$SqlPassword
)

Write-Host "=== Configuring Azure Static Web App Environment Variables ===" -ForegroundColor Green
Write-Host ""

# Load environment variables from .env.local
if (Test-Path ".env.local") {
    Write-Host "Loading credentials from .env.local..." -ForegroundColor Cyan
    $envContent = Get-Content ".env.local"
    
    $storageAccount = ($envContent | Select-String "AZURE_STORAGE_ACCOUNT=").ToString().Split('=')[1]
    $storageKey = ($envContent | Select-String "AZURE_STORAGE_KEY=").ToString().Split('=')[1]
    $storageContainer = ($envContent | Select-String "AZURE_STORAGE_CONTAINER=").ToString().Split('=')[1]
    $sqlServer = ($envContent | Select-String "AZURE_SQL_SERVER=").ToString().Split('=')[1]
    $sqlDatabase = ($envContent | Select-String "AZURE_SQL_DATABASE=").ToString().Split('=')[1]
    $sqlUser = ($envContent | Select-String "AZURE_SQL_USER=").ToString().Split('=')[1]
    
    Write-Host "✓ Loaded credentials" -ForegroundColor Green
} else {
    Write-Host "ERROR: .env.local file not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  Resource Group: $ResourceGroup"
Write-Host "  App Name: $AppName"
Write-Host "  Storage Account: $storageAccount"
Write-Host "  Storage Container: $storageContainer"
Write-Host "  SQL Server: $sqlServer"
Write-Host "  SQL Database: $sqlDatabase"
Write-Host "  SQL User: $sqlUser"
Write-Host ""

$confirmation = Read-Host "Do you want to apply these settings? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Applying configuration to Azure Static Web App..." -ForegroundColor Cyan

# Use Azure CLI to set the environment variables
try {
    $azCmd = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
    
    & $azCmd staticwebapp appsettings set `
        --name $AppName `
        --resource-group $ResourceGroup `
        --setting-names `
            "AZURE_STORAGE_ACCOUNT=$storageAccount" `
            "AZURE_STORAGE_KEY=$storageKey" `
            "AZURE_STORAGE_CONTAINER=$storageContainer" `
            "AZURE_SQL_SERVER=$sqlServer" `
            "AZURE_SQL_DATABASE=$sqlDatabase" `
            "AZURE_SQL_USER=$sqlUser" `
            "AZURE_SQL_PASSWORD=$SqlPassword"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== Configuration Complete ===" -ForegroundColor Green
        Write-Host ""
        Write-Host "Environment variables have been set successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Wait 2-3 minutes for changes to propagate"
        Write-Host "2. Clear your browser cache (Ctrl+Shift+Delete)"
        Write-Host "3. Reload the application"
        Write-Host "4. Images should now load correctly!"
        Write-Host ""
    } else {
        Write-Host "ERROR: Failed to set environment variables" -ForegroundColor Red
        exit 1
    }
} catch {
    $errorMsg = $_.Exception.Message
    Write-Host "ERROR: $errorMsg" -ForegroundColor Red
    exit 1
}
