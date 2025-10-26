# Add uiMonth and uiYear columns to UnindexedFiles table
# Run this script to update the Azure SQL database

$ErrorActionPreference = "Stop"

Write-Host "=== Adding Date Columns to UnindexedFiles Table ===" -ForegroundColor Cyan

# Load environment variables
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Host "✓ Loaded environment variables from .env.local" -ForegroundColor Green
}

$server = $env:DB_SERVER
$database = $env:DB_DATABASE
$username = $env:DB_USER
$password = $env:DB_PASSWORD

if (-not $server -or -not $database -or -not $username -or -not $password) {
    Write-Host "❌ Missing database configuration. Check .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "Server: $server" -ForegroundColor Gray
Write-Host "Database: $database" -ForegroundColor Gray

# Read migration script
$migrationScript = Get-Content -Path "database\add-date-columns.sql" -Raw

# Execute migration
Write-Host "`nExecuting migration..." -ForegroundColor Yellow

try {
    # Use sqlcmd if available
    if (Get-Command sqlcmd -ErrorAction SilentlyContinue) {
        $migrationScript | sqlcmd -S $server -d $database -U $username -P $password -b
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "`n✓ Migration completed successfully!" -ForegroundColor Green
            Write-Host "  UnindexedFiles table now has uiMonth and uiYear columns" -ForegroundColor Gray
        } else {
            Write-Host "`n❌ Migration failed with exit code $LASTEXITCODE" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ sqlcmd not found. Please install SQL Server command line tools." -ForegroundColor Red
        Write-Host "   Download from: https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "`n❌ Error executing migration: $_" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Migration Complete ===" -ForegroundColor Cyan
Write-Host "You can now upload files and the date metadata will be extracted and stored." -ForegroundColor Gray
