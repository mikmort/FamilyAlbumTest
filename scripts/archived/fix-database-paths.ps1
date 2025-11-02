# Fix database paths for Devorah's Wedding and other duplicate path issues
# This script connects to Azure SQL and runs the fix queries

param(
    [string]$SqlFile = "scripts\fix-devorah-wedding-paths.sql"
)

Write-Host "=== Fixing Database Paths ===" -ForegroundColor Cyan

# Load environment variables from .env.local if it exists
if (Test-Path ".env.local") {
    Write-Host "Loading connection info from .env.local..." -ForegroundColor Yellow
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim().Trim('"')
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Get connection details from environment
$server = $env:AZURE_SQL_SERVER
$database = $env:AZURE_SQL_DATABASE
$username = $env:AZURE_SQL_USER
$password = $env:AZURE_SQL_PASSWORD

if (-not $server -or -not $database) {
    Write-Host "ERROR: Missing database connection information" -ForegroundColor Red
    Write-Host "Please ensure .env.local contains:" -ForegroundColor Red
    Write-Host "  AZURE_SQL_SERVER=<your-server>.database.windows.net" -ForegroundColor Yellow
    Write-Host "  AZURE_SQL_DATABASE=<your-database>" -ForegroundColor Yellow
    Write-Host "  AZURE_SQL_USER=<your-username>" -ForegroundColor Yellow
    Write-Host "  AZURE_SQL_PASSWORD=<your-password>" -ForegroundColor Yellow
    exit 1
}

# Build connection string
$connectionString = "Server=tcp:$server,1433;Initial Catalog=$database;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "Connecting to: $server" -ForegroundColor Yellow
Write-Host "Database: $database" -ForegroundColor Yellow
Write-Host ""

# Read SQL file
if (-not (Test-Path $SqlFile)) {
    Write-Host "ERROR: SQL file not found: $SqlFile" -ForegroundColor Red
    exit 1
}

$sqlContent = Get-Content $SqlFile -Raw

# Connect and execute
try {
    Import-Module SqlServer -ErrorAction Stop
    
    Write-Host "Executing SQL script..." -ForegroundColor Yellow
    Invoke-Sqlcmd -ConnectionString $connectionString -Query $sqlContent -Verbose
    
    Write-Host ""
    Write-Host "✓ Database paths fixed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "The changes will be reflected the next time you reload the gallery." -ForegroundColor Cyan
    
} catch {
    Write-Host "ERROR: Failed to execute SQL" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
