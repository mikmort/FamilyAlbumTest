# Simple SQLite Schema Inspector
$dbPath = "C:\Users\mikmort\Downloads\FamilyAlbum.db"

# Load SQLite assembly
Add-Type -AssemblyName System.Data

# Create connection
$connectionString = "Data Source=$dbPath;Version=3;Read Only=True;"
$connection = New-Object System.Data.SQLite.SQLiteConnection($connectionString)

try {
    $connection.Open()
    
    # Get table names
    $tablesQuery = "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    $command = $connection.CreateCommand()
    $command.CommandText = $tablesQuery
    $reader = $command.ExecuteReader()
    
    Write-Host "=== Tables in Database ===" -ForegroundColor Cyan
    $tables = @()
    while ($reader.Read()) {
        $tables += $reader["name"]
        Write-Host $reader["name"] -ForegroundColor White
    }
    $reader.Close()
    
    # Get schema for each table
    Write-Host ""
    Write-Host "=== Table Schemas ===" -ForegroundColor Cyan
    foreach ($table in $tables) {
        Write-Host "`n$table columns:" -ForegroundColor Yellow
        $schemaQuery = "PRAGMA table_info($table)"
        $command.CommandText = $schemaQuery
        $reader = $command.ExecuteReader()
        
        while ($reader.Read()) {
            $colName = $reader["name"]
            $colType = $reader["type"]
            Write-Host "  $colName ($colType)" -ForegroundColor Gray
        }
        $reader.Close()
        
        # Get row count
        $countQuery = "SELECT COUNT(*) FROM $table"
        $command.CommandText = $countQuery
        $count = $command.ExecuteScalar()
        Write-Host "  Total rows: $count" -ForegroundColor Green
    }
    
} catch {
    # If SQLite assembly is not available, use alternative method
    Write-Host "SQLite .NET library not available. Please install DB Browser for SQLite to inspect the database." -ForegroundColor Red
    Write-Host "Download from: https://sqlitebrowser.org/dl/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Or share the first few rows of each table so I can understand the structure." -ForegroundColor Yellow
} finally {
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
}
