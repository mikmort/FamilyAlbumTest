# Database Setup Script
# This script initializes the Azure SQL Database schema programmatically

# Load deployment info
$deploymentInfoFile = Get-ChildItem "deployment-info-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $deploymentInfoFile) {
    Write-Host "Error: Could not find deployment info file" -ForegroundColor Red
    exit 1
}

$deploymentInfo = Get-Content $deploymentInfoFile.FullName -Raw

# Extract connection details
$sqlServer = $null
$sqlDatabase = $null
$sqlUsername = $null

if ($deploymentInfo -match 'SQL Server: (.+)') {
    $sqlServer = $Matches[1].Trim()
}
if ($deploymentInfo -match 'SQL Database: (.+)') {
    $sqlDatabase = $Matches[1].Trim()
}
if ($deploymentInfo -match 'SQL Username: (.+)') {
    $sqlUsername = $Matches[1].Trim()
}

if (-not $sqlServer -or -not $sqlDatabase -or -not $sqlUsername) {
    Write-Host "Error: Could not parse deployment info" -ForegroundColor Red
    exit 1
}

Write-Host "=== Database Schema Setup ===" -ForegroundColor Cyan
Write-Host "Server: $sqlServer" -ForegroundColor White
Write-Host "Database: $sqlDatabase" -ForegroundColor White
Write-Host ""

# Prompt for password
$sqlPasswordSecure = Read-Host "Enter SQL Admin Password" -AsSecureString
$sqlPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($sqlPasswordSecure))

# Read schema file
$schemaPath = "database\schema.sql"
if (-not (Test-Path $schemaPath)) {
    Write-Host "Error: Could not find $schemaPath" -ForegroundColor Red
    exit 1
}

Write-Host "Reading schema file..." -ForegroundColor Yellow
$schema = Get-Content $schemaPath -Raw

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Write-Host "Importing SqlServer module..." -ForegroundColor Yellow
Import-Module SqlServer

Write-Host "Connecting to database..." -ForegroundColor Yellow
try {
    # Execute schema
    Write-Host "Creating tables and triggers..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ServerInstance $sqlServer `
                  -Database $sqlDatabase `
                  -Username $sqlUsername `
                  -Password $sqlPassword `
                  -Query $schema `
                  -Verbose
    
    Write-Host ""
    Write-Host "[OK] Database schema created successfully!" -ForegroundColor Green
    
    # Verify tables
    Write-Host ""
    Write-Host "Verifying tables..." -ForegroundColor Yellow
    $tables = Invoke-Sqlcmd -ServerInstance $sqlServer `
                           -Database $sqlDatabase `
                           -Username $sqlUsername `
                           -Password $sqlPassword `
                           -Query "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
    
    Write-Host "Tables created:" -ForegroundColor Green
    foreach ($table in $tables) {
        Write-Host "  - $($table.TABLE_NAME)" -ForegroundColor White
    }
    
} catch {
    Write-Host ""
    Write-Host "Error executing schema: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "If the database is paused (serverless), it may take 1-2 minutes to wake up." -ForegroundColor Yellow
    Write-Host "Please wait and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Database setup complete!" -ForegroundColor Green
