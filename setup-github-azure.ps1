# GitHub and Azure Configuration Script
# This script configures GitHub secrets and Azure Static Web App environment variables

Write-Host "=== GitHub and Azure Configuration ===" -ForegroundColor Cyan
Write-Host ""

# Load deployment info
$deploymentInfoFile = Get-ChildItem "deployment-info-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $deploymentInfoFile) {
    Write-Host "Error: Could not find deployment info file" -ForegroundColor Red
    exit 1
}

$deploymentInfo = Get-Content $deploymentInfoFile.FullName -Raw

# Extract values
$resourceGroup = $null
$staticWebAppName = $null
$deploymentToken = $null

if ($deploymentInfo -match 'Resource Group: (.+)') {
    $resourceGroup = $Matches[1].Trim()
}
if ($deploymentInfo -match 'Static Web App: (.+)') {
    $staticWebAppName = $Matches[1].Trim()
}
if ($deploymentInfo -match 'GitHub Secret for AZURE_STATIC_WEB_APPS_API_TOKEN:\s*(.+)') {
    $deploymentToken = $Matches[1].Trim()
}

Write-Host "Resource Group: $resourceGroup" -ForegroundColor White
Write-Host "Static Web App: $staticWebAppName" -ForegroundColor White
Write-Host ""

# Check if GitHub CLI is installed
$ghInstalled = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)

if (-not $ghInstalled) {
    Write-Host "Installing GitHub CLI..." -ForegroundColor Yellow
    winget install --id GitHub.cli --silent --accept-source-agreements --accept-package-agreements
    
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
}

# Configure GitHub secret
Write-Host "Step 1: Configuring GitHub secret..." -ForegroundColor Yellow

try {
    # Check if already authenticated
    gh auth status 2>$null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Please authenticate with GitHub..." -ForegroundColor Cyan
        gh auth login
    }
    
    # Set the secret
    Write-Host "Adding AZURE_STATIC_WEB_APPS_API_TOKEN secret..." -ForegroundColor Yellow
    $deploymentToken | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN --repo mikmort/FamilyAlbumTest
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[OK] GitHub secret configured!" -ForegroundColor Green
    } else {
        Write-Host "Failed to set GitHub secret" -ForegroundColor Red
    }
} catch {
    Write-Host "Error configuring GitHub: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual setup:" -ForegroundColor Yellow
    Write-Host "1. Go to GitHub settings/secrets/actions page" -ForegroundColor White
    Write-Host "2. Click 'New repository secret'" -ForegroundColor White
    Write-Host "3. Name: AZURE_STATIC_WEB_APPS_API_TOKEN" -ForegroundColor White
    Write-Host "4. Secret: $deploymentToken" -ForegroundColor White
}

Write-Host ""
Write-Host "Step 2: Configuring Azure Static Web App environment variables..." -ForegroundColor Yellow

# Load .env.local
if (-not (Test-Path ".env.local")) {
    Write-Host "Error: .env.local not found" -ForegroundColor Red
    exit 1
}

$envContent = Get-Content ".env.local" -Raw

# Parse environment variables
$envVars = @{}
$envContent -split "`n" | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        if ($line -match '^([^=]+)=(.+)$') {
            $envVars[$Matches[1]] = $Matches[2]
        }
    }
}

# Add Azure CLI path
$azCliPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"
if (Test-Path $azCliPath) {
    $env:Path = "$azCliPath;$env:Path"
}

# Configure each environment variable in Azure
$envVarsToAdd = @(
    'AZURE_SQL_SERVER',
    'AZURE_SQL_DATABASE', 
    'AZURE_SQL_USER',
    'AZURE_SQL_PASSWORD',
    'AZURE_STORAGE_ACCOUNT',
    'AZURE_STORAGE_KEY',
    'AZURE_STORAGE_CONTAINER'
)

foreach ($varName in $envVarsToAdd) {
    if ($envVars.ContainsKey($varName)) {
        $varValue = $envVars[$varName]
        Write-Host "  Setting $varName..." -ForegroundColor Gray
        
        az staticwebapp appsettings set `
            --name $staticWebAppName `
            --resource-group $resourceGroup `
            --setting-names "${varName}=$varValue" `
            --output none 2>&1 | Out-Null
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  OK $varName configured" -ForegroundColor Green
        } else {
            Write-Host "  X Failed to set $varName" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "[OK] Azure environment variables configured!" -ForegroundColor Green

Write-Host ""
Write-Host "=== Configuration Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Commit and push your code to GitHub:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m ""Initial deployment""" -ForegroundColor Gray
Write-Host "   git push origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "2. GitHub Actions will automatically deploy to Azure" -ForegroundColor White
Write-Host ""
Write-Host "3. Monitor deployment at github.com/mikmort/FamilyAlbumTest/actions" -ForegroundColor White
