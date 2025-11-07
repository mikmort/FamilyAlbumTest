# Deploy Python Functions to Azure Function App
# This script deploys the face recognition Python functions

Write-Host "Deploying Python Functions to familyalbum-faces-api..." -ForegroundColor Cyan

# Change to api-python directory
Push-Location api-python

try {
    # Create deployment package
    Write-Host "`nCreating deployment package..." -ForegroundColor Yellow
    if (Test-Path deploy.zip) {
        Remove-Item deploy.zip -Force
    }
    
    # Get all files except those we want to exclude
    $filesToInclude = Get-ChildItem -Recurse | Where-Object { 
        $_.FullName -notmatch '\.venv\\' -and 
        $_.FullName -notmatch '__pycache__' -and 
        $_.Extension -ne '.pyc' -and
        $_.Name -ne 'local.settings.json' -and
        $_.Name -ne 'deploy.zip'
    }
    
    Compress-Archive -Path $filesToInclude.FullName -DestinationPath deploy.zip -Force
    
    Write-Host "Deployment package created: deploy.zip" -ForegroundColor Green
    
    # Deploy to Azure
    Write-Host "`nDeploying to Azure Function App..." -ForegroundColor Yellow
    Write-Host "This will take several minutes as Python dependencies (including dlib) are compiled..." -ForegroundColor Gray
    
    az functionapp deployment source config-zip `
        --resource-group familyalbum-prod-rg `
        --name familyalbum-faces-api `
        --src deploy.zip `
        --build-remote true `
        --timeout 600
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Deployment completed successfully!" -ForegroundColor Green
        
        # List deployed functions
        Write-Host "`nDeployed functions:" -ForegroundColor Cyan
        az functionapp function list `
            --name familyalbum-faces-api `
            --resource-group familyalbum-prod-rg `
            --query "[].{Name:name, URL:invokeUrlTemplate}" `
            --output table
        
        Write-Host "`nFunction App URL: https://familyalbum-faces-api.azurewebsites.net" -ForegroundColor Green
    } else {
        Write-Host "`n✗ Deployment failed. Check the logs above for details." -ForegroundColor Red
        exit 1
    }
    
} finally {
    Pop-Location
}

Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Test the functions using the Azure Portal or Postman"
Write-Host "2. Update Node.js API in /api to call these Python endpoints"
Write-Host "3. Test face detection by uploading a photo with faces"
