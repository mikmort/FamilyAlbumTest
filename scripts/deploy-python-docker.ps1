# Docker Deployment Script for Python Azure Functions
# This script builds and deploys the Python functions as a Docker container

param(
    [string]$ResourceGroup = "familyalbum-prod-rg",
    [string]$FunctionAppName = "familyalbum-faces-api",
    [string]$RegistryName = "familyalbumregistry",
    [string]$ImageName = "faces-api",
    [string]$ImageTag = "latest"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Docker Deployment for Python Functions" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create Azure Container Registry (if it doesn't exist)
Write-Host "Step 1: Checking Azure Container Registry..." -ForegroundColor Yellow
$registryExists = az acr show --name $RegistryName --resource-group $ResourceGroup 2>$null
if (-not $registryExists) {
    Write-Host "Creating Azure Container Registry: $RegistryName" -ForegroundColor Green
    az acr create `
        --resource-group $ResourceGroup `
        --name $RegistryName `
        --sku Basic `
        --admin-enabled true
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to create Container Registry" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Container Registry already exists: $RegistryName" -ForegroundColor Green
}

# Step 2: Log in to Azure Container Registry
Write-Host "`nStep 2: Logging in to Azure Container Registry..." -ForegroundColor Yellow
az acr login --name $RegistryName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to log in to Container Registry" -ForegroundColor Red
    exit 1
}
Write-Host "Successfully logged in to ACR" -ForegroundColor Green

# Step 3: Build Docker image
Write-Host "`nStep 3: Building Docker image..." -ForegroundColor Yellow
$fullImageName = "$RegistryName.azurecr.io/${ImageName}:${ImageTag}"
Write-Host "Image name: $fullImageName" -ForegroundColor Cyan

Push-Location api-python
docker build -t $fullImageName .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to build Docker image" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "Docker image built successfully" -ForegroundColor Green

# Step 4: Push image to Azure Container Registry
Write-Host "`nStep 4: Pushing image to Azure Container Registry..." -ForegroundColor Yellow
docker push $fullImageName
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to push Docker image" -ForegroundColor Red
    exit 1
}
Write-Host "Image pushed successfully" -ForegroundColor Green

# Step 5: Get ACR credentials
Write-Host "`nStep 5: Getting ACR credentials..." -ForegroundColor Yellow
$acrCredentials = az acr credential show --name $RegistryName --query "{username:username, password:passwords[0].value}" -o json | ConvertFrom-Json
$acrUsername = $acrCredentials.username
$acrPassword = $acrCredentials.password

# Step 6: Configure Function App to use container
Write-Host "`nStep 6: Configuring Function App to use Docker container..." -ForegroundColor Yellow
az functionapp config container set `
    --name $FunctionAppName `
    --resource-group $ResourceGroup `
    --docker-custom-image-name $fullImageName `
    --docker-registry-server-url "https://$RegistryName.azurecr.io" `
    --docker-registry-server-user $acrUsername `
    --docker-registry-server-password $acrPassword

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to configure Function App" -ForegroundColor Red
    exit 1
}
Write-Host "Function App configured successfully" -ForegroundColor Green

# Step 7: Restart Function App
Write-Host "`nStep 7: Restarting Function App..." -ForegroundColor Yellow
az functionapp restart `
    --name $FunctionAppName `
    --resource-group $ResourceGroup

if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to restart Function App" -ForegroundColor Red
    exit 1
}
Write-Host "Function App restarted successfully" -ForegroundColor Green

# Step 8: Wait for deployment to complete
Write-Host "`nStep 8: Waiting for deployment to complete (60 seconds)..." -ForegroundColor Yellow
Start-Sleep -Seconds 60

# Step 9: Verify deployment
Write-Host "`nStep 9: Verifying deployment..." -ForegroundColor Yellow
Write-Host "Checking Function App URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri "https://$FunctionAppName.azurewebsites.net" -UseBasicParsing -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        Write-Host "Function App is responding!" -ForegroundColor Green
    }
} catch {
    Write-Host "Function App may still be starting up. Check Azure Portal for status." -ForegroundColor Yellow
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Deployment Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Container Registry: $RegistryName.azurecr.io" -ForegroundColor White
Write-Host "Image: $fullImageName" -ForegroundColor White
Write-Host "Function App: $FunctionAppName" -ForegroundColor White
Write-Host "URL: https://$FunctionAppName.azurewebsites.net" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Check Azure Portal for function deployment status" -ForegroundColor White
Write-Host "2. Test endpoints:" -ForegroundColor White
Write-Host "   - https://$FunctionAppName.azurewebsites.net/api/faces/train" -ForegroundColor Cyan
Write-Host "   - https://$FunctionAppName.azurewebsites.net/api/faces/seed" -ForegroundColor Cyan
Write-Host "   - https://$FunctionAppName.azurewebsites.net/api/detect-faces" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment complete!" -ForegroundColor Green
