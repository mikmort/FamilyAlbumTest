# Quick Deploy Script for Family Album Infrastructure

# Add Azure CLI to PATH for this session
$azCliPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
if (Test-Path $azCliPath) {
    $env:Path = "$azCliPath;$env:Path"
}

# Configuration
$environment = "prod"
$location = "eastus2"  # Changed from eastus due to provisioning restrictions
$sqlAdminUsername = "familyadmin"

# Prompt for secure password
Write-Host "=== Family Album Infrastructure Deployment ===" -ForegroundColor Cyan
Write-Host ""
$sqlAdminPasswordSecure = Read-Host "Enter SQL Admin Password (min 8 chars, uppercase, lowercase, number, special char)" -AsSecureString
$sqlAdminPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sqlAdminPasswordSecure))

# Validate password strength
if ($sqlAdminPassword.Length -lt 8) {
    Write-Host "Error: Password must be at least 8 characters long" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 1: Logging in to Azure..." -ForegroundColor Yellow
az login

# Show current subscription
Write-Host ""
Write-Host "Current Azure Subscription:" -ForegroundColor Yellow
az account show --query "{Name:name, ID:id, State:state}" -o table

Write-Host ""
$confirmSub = Read-Host "Is this the correct subscription? (y/n)"
if ($confirmSub -ne 'y') {
    Write-Host "Please run 'az account list' to see available subscriptions" -ForegroundColor Yellow
    Write-Host "Then run 'az account set --subscription <subscription-id>'" -ForegroundColor Yellow
    exit 0
}

# Generate deployment name
$deploymentName = "familyalbum-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

Write-Host ""
Write-Host "Step 2: Validating Bicep templates..." -ForegroundColor Yellow
$validationOutput = az deployment sub validate `
  --location $location `
  --template-file infrastructure/main.bicep `
  --parameters environment=$environment `
               location=$location `
               sqlAdminUsername=$sqlAdminUsername `
               sqlAdminPassword=$sqlAdminPassword 2>&1

# Check if there are actual errors (not just warnings)
$hasErrors = $validationOutput | Where-Object { $_ -match "Error BCP\d+" }

if ($LASTEXITCODE -ne 0 -and $hasErrors) {
    Write-Host "Validation failed! Please fix errors and try again." -ForegroundColor Red
    $validationOutput | ForEach-Object { Write-Host $_ }
    exit 1
}

Write-Host "[OK] Validation passed! (Warnings are OK)" -ForegroundColor Green

# What-if preview
Write-Host ""
Write-Host "Step 3: Preview of resources to be created..." -ForegroundColor Yellow
az deployment sub what-if `
  --location $location `
  --template-file infrastructure/main.bicep `
  --parameters environment=$environment `
               location=$location `
               sqlAdminUsername=$sqlAdminUsername `
               sqlAdminPassword=$sqlAdminPassword

Write-Host ""
$confirmDeploy = Read-Host "Proceed with deployment? (y/n)"
if ($confirmDeploy -ne 'y') {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Step 4: Deploying infrastructure..." -ForegroundColor Yellow
Write-Host "Deployment name: $deploymentName" -ForegroundColor Cyan
Write-Host "This will take 5-10 minutes..." -ForegroundColor Cyan
Write-Host ""

az deployment sub create `
  --name $deploymentName `
  --location $location `
  --template-file infrastructure/main.bicep `
  --parameters environment=$environment `
               location=$location `
               sqlAdminUsername=$sqlAdminUsername `
               sqlAdminPassword=$sqlAdminPassword

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Run the following to see error details:" -ForegroundColor Yellow
    Write-Host "az deployment sub show --name $deploymentName --query properties.error" -ForegroundColor Cyan
    exit 1
}

Write-Host ""
Write-Host "[OK] Deployment completed successfully!" -ForegroundColor Green

# Get outputs
Write-Host ""
Write-Host "Step 5: Retrieving deployment outputs..." -ForegroundColor Yellow

$outputs = az deployment sub show `
  --name $deploymentName `
  --query properties.outputs `
  --output json | ConvertFrom-Json

$resourceGroup = $outputs.resourceGroupName.value
$sqlServer = $outputs.sqlServerFqdn.value
$sqlDatabase = $outputs.sqlDatabaseName.value
$storageAccount = $outputs.storageAccountName.value
$storageContainer = $outputs.storageContainerName.value
$webAppName = $outputs.staticWebAppName.value
$webAppUrl = $outputs.staticWebAppUrl.value

# Get storage key
$storageKey = az storage account keys list `
  --account-name $storageAccount `
  --resource-group $resourceGroup `
  --query '[0].value' -o tsv

# Get Static Web App deployment token
$deploymentToken = az staticwebapp secrets list `
  --name $webAppName `
  --resource-group $resourceGroup `
  --query properties.apiKey -o tsv

Write-Host ""
Write-Host "=== Deployment Summary ===" -ForegroundColor Cyan
Write-Host "Resource Group:     $resourceGroup" -ForegroundColor White
Write-Host "SQL Server:         $sqlServer" -ForegroundColor White
Write-Host "SQL Database:       $sqlDatabase" -ForegroundColor White
Write-Host "Storage Account:    $storageAccount" -ForegroundColor White
Write-Host "Storage Container:  $storageContainer" -ForegroundColor White
Write-Host "Web App Name:       $webAppName" -ForegroundColor White
Write-Host "Web App URL:        $webAppUrl" -ForegroundColor White
Write-Host ""

# Create .env.local file
Write-Host "Step 6: Creating .env.local file..." -ForegroundColor Yellow
$envContent = @"
# Azure SQL Database
AZURE_SQL_SERVER=$sqlServer
AZURE_SQL_DATABASE=$sqlDatabase
AZURE_SQL_USER=$sqlAdminUsername
AZURE_SQL_PASSWORD=$sqlAdminPassword

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=$storageAccount
AZURE_STORAGE_KEY=$storageKey
AZURE_STORAGE_CONTAINER=$storageContainer
"@

Set-Content -Path ".env.local" -Value $envContent
Write-Host "[OK] Created .env.local file" -ForegroundColor Green

# Save deployment info
$deploymentInfo = @"
=== Family Album Deployment Information ===
Deployment Name: $deploymentName
Deployment Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

Resource Group: $resourceGroup
Region: $location
Environment: $environment

SQL Server: $sqlServer
SQL Database: $sqlDatabase
SQL Username: $sqlAdminUsername

Storage Account: $storageAccount
Storage Container: $storageContainer

Static Web App: $webAppName
Web App URL: $webAppUrl

GitHub Secret for AZURE_STATIC_WEB_APPS_API_TOKEN:
$deploymentToken
"@

$deploymentInfoFile = "deployment-info-$(Get-Date -Format 'yyyyMMdd-HHmmss').txt"
Set-Content -Path $deploymentInfoFile -Value $deploymentInfo
Write-Host "[OK] Saved deployment info to: $deploymentInfoFile" -ForegroundColor Green

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Initialize Database Schema:" -ForegroundColor Yellow
Write-Host "   - Install Azure Data Studio: https://aka.ms/azuredatastudio" -ForegroundColor White
Write-Host "   - Connect to: $sqlServer" -ForegroundColor White
Write-Host "   - Database: $sqlDatabase" -ForegroundColor White
Write-Host "   - Username: $sqlAdminUsername" -ForegroundColor White
Write-Host "   - Run the script: database/schema.sql" -ForegroundColor White
Write-Host ""

Write-Host "2. Configure GitHub:" -ForegroundColor Yellow
Write-Host "   - Add this secret to GitHub Actions:" -ForegroundColor White
Write-Host "     Name: AZURE_STATIC_WEB_APPS_API_TOKEN" -ForegroundColor Cyan
Write-Host "     Value: $deploymentToken" -ForegroundColor Cyan
Write-Host ""

Write-Host "3. Test Locally:" -ForegroundColor Yellow
Write-Host "   npm install" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""

Write-Host "4. Deploy to Azure:" -ForegroundColor Yellow
Write-Host "   git add ." -ForegroundColor White
Write-Host "   git commit -m 'Initial deployment'" -ForegroundColor White
Write-Host "   git push origin main" -ForegroundColor White
Write-Host ""

Write-Host "All deployment information saved to: $deploymentInfoFile" -ForegroundColor Green
Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
