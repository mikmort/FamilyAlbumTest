# Add uiMonth and uiYear columns to UnindexedFiles table
$ErrorActionPreference = "Stop"

Write-Output "=== Adding Date Columns to UnindexedFiles Table ==="

# Load environment variables
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
    Write-Output "Loaded environment variables from .env.local"
}

$server = $env:DB_SERVER
$database = $env:DB_DATABASE
$username = $env:DB_USER
$password = $env:DB_PASSWORD

if (-not $server -or -not $database -or -not $username -or -not $password) {
    Write-Error "Missing database configuration. Check .env.local"
    exit 1
}

Write-Output "Server: $server"
Write-Output "Database: $database"

# Read migration script
$migrationScript = Get-Content -Path "database\add-date-columns.sql" -Raw

# Execute migration
Write-Output "Executing migration..."

$sqlcmdExists = Get-Command sqlcmd -ErrorAction SilentlyContinue

if ($sqlcmdExists) {
    $migrationScript | sqlcmd -S $server -d $database -U $username -P $password -b
    
    if ($LASTEXITCODE -eq 0) {
        Write-Output "Migration completed successfully!"
        Write-Output "UnindexedFiles table now has uiMonth and uiYear columns"
    } else {
        Write-Error "Migration failed with exit code $LASTEXITCODE"
        exit 1
    }
} else {
    Write-Error "sqlcmd not found. Please install SQL Server command line tools."
    Write-Output "Download from: https://docs.microsoft.com/en-us/sql/tools/sqlcmd-utility"
    exit 1
}

Write-Output "=== Migration Complete ==="
