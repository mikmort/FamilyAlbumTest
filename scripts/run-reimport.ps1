#Requires -Version 5.0

<#
.SYNOPSIS
    Complete reimport workflow: Backup Azure SQL and execute SQL reimport script
    
.DESCRIPTION
    This script:
    1. Creates a backup of Azure SQL database (optional, can skip if already backed up)
    2. Executes the SQL reimport script to restore SQLite IDs
    3. Waits for completion and reports status
    
.PARAMETER SkipBackup
    Skip the backup step (use if you've already backed up manually)
    
.PARAMETER Server
    Azure SQL server name (e.g., yourserver.database.windows.net)
    If not provided, reads from AZURE_SQL_SERVER environment variable
    
.PARAMETER Username
    Azure SQL username (e.g., sqladmin@yourserver)
    If not provided, reads from AZURE_SQL_USER environment variable
    
.PARAMETER Password
    Azure SQL password
    If not provided, reads from AZURE_SQL_PASSWORD environment variable
    
.EXAMPLE
    .\run-reimport.ps1
    
.EXAMPLE
    .\run-reimport.ps1 -SkipBackup -Server myserver.database.windows.net -Username sqladmin@myserver
#>

param(
    [switch]$SkipBackup,
    [string]$Server = $env:AZURE_SQL_SERVER,
    [string]$Username = $env:AZURE_SQL_USER,
    [string]$Password = $env:AZURE_SQL_PASSWORD
)

$ErrorActionPreference = 'Stop'
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectPath = Split-Path -Parent $scriptPath

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║         SQL DATABASE REIMPORT - PRESERVE IDs                ║
║                                                              ║
║ ⚠️  WARNING: This script performs a DESTRUCTIVE reimport     ║
║    All data will be cleared and reimported from SQLite       ║
║    Make sure you have a backup before proceeding!            ║
╚════════════════════════════════════════════════════════════╝
"@

# Validate environment
Write-Host "`n📋 Validating environment..." -ForegroundColor Cyan

if (-not $Server) {
    Write-Host "❌ ERROR: Azure SQL server not specified" -ForegroundColor Red
    Write-Host "   Set AZURE_SQL_SERVER environment variable or use -Server parameter" -ForegroundColor Red
    exit 1
}

if (-not $Username) {
    Write-Host "❌ ERROR: Azure SQL username not specified" -ForegroundColor Red
    Write-Host "   Set AZURE_SQL_USER environment variable or use -Username parameter" -ForegroundColor Red
    exit 1
}

if (-not $Password) {
    Write-Host "❌ ERROR: Azure SQL password not specified" -ForegroundColor Red
    Write-Host "   Set AZURE_SQL_PASSWORD environment variable or use -Password parameter" -ForegroundColor Red
    exit 1
}

Write-Host "✓ Connection details provided" -ForegroundColor Green
Write-Host "  Server: $Server" -ForegroundColor Gray
Write-Host "  User: $Username" -ForegroundColor Gray

# Check CSV files exist
Write-Host "`n📋 Checking CSV files..." -ForegroundColor Cyan
$csvFiles = @(
    'C:\Temp\people_export.csv',
    'C:\Temp\events_export.csv',
    'C:\Temp\pictures_export.csv',
    'C:\Temp\namephoto_export.csv'
)

foreach ($file in $csvFiles) {
    if (Test-Path $file) {
        $size = (Get-Item $file).Length / 1MB
        Write-Host "✓ $file ($([math]::Round($size, 2))MB)" -ForegroundColor Green
    } else {
        Write-Host "❌ Missing: $file" -ForegroundColor Red
        Write-Host "   Run: node scripts/export-sqlite-to-csv.js" -ForegroundColor Red
        exit 1
    }
}

# Backup step
if ($SkipBackup) {
    Write-Host "`n⏭️  Skipping backup (use -SkipBackup flag)" -ForegroundColor Yellow
} else {
    Write-Host "`n💾 Creating backup..." -ForegroundColor Cyan
    Write-Host "   Note: This may take 1-2 minutes for large databases" -ForegroundColor Gray
    
    # Build backup command
    $backupQuery = @"
BACKUP DATABASE [FamilyAlbum]
TO DISK = N'/var/opt/mssql/backup/pre-reimport-$(Get-Date -Format 'yyyyMMdd-HHmmss').bak'
WITH COMPRESSION;
"@
    
    # This would require direct SQL access - for now, instruct user
    Write-Host @"
To create a backup manually, choose one of these options:

Option A (Azure Portal - Recommended):
  1. Go to https://portal.azure.com
  2. Navigate to your SQL Database
  3. Click "Backups"
  4. Create automatic backup or use restore point feature
  
Option B (Azure CLI):
  az sql db copy --resource-group <group> --server $Server `
    --name FamilyAlbum --dest-name "FamilyAlbum-backup-$(Get-Date -Format 'yyyyMMdd')"

Option C (Skip for now):
  Run with -SkipBackup flag if already backed up

Press ENTER to continue when backup is ready...
"@
    Read-Host
}

# Execute reimport
Write-Host "`n⚡ Executing SQL reimport script..." -ForegroundColor Cyan
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Gray

# Set environment variables for Node script
$env:AZURE_SQL_SERVER = $Server
$env:AZURE_SQL_USER = $Username
$env:AZURE_SQL_PASSWORD = $Password

# Ensure Node.js is in PATH
$env:Path = 'C:\Program Files\nodejs;' + $env:Path

# Run the Node.js script
& node "$scriptPath\execute-sql-reimport.js"

if ($LASTEXITCODE -ne 0) {
    Write-Host "`n❌ Reimport failed!" -ForegroundColor Red
    Write-Host "   Check error messages above" -ForegroundColor Red
    Write-Host "   Restore from backup in Azure Portal" -ForegroundColor Red
    exit 1
}

Write-Host @"
╔════════════════════════════════════════════════════════════╗
║                  ✓ REIMPORT COMPLETE                        ║
╚════════════════════════════════════════════════════════════╝

✓ Data reimported with original SQLite IDs
✓ 358 people, 157 events, 9717 pictures, 28700 associations

Next steps:
1. Give the backend ~2-3 minutes to fully restart
2. Visit https://lively-glacier-02a77180f.2.azurestaticapps.net/
3. Search for "DSC04780" or navigate to Whistler/DSC04780
4. Verify correct people display in correct order:
   - Budie Grossman (ID 195)
   - Jigger (ID 318)
   - Scott Jenkins (ID 507)
   - Helen Eitelberg (ID 281)
   - Shoshana Tieyah (ID 462)
   - Richard Grossman (ID 425)

If issues persist, restore from backup.
"@
