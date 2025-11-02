# Run SQL script against Azure SQL Database
param(
    [string]$Server = "familyalbum-prod-sql-gajerhxssqswm.database.windows.net",
    [string]$Database = "FamilyAlbum",
    [string]$Username = "familyadmin",
    [string]$Password = "Jam3jam3!",
    [string]$ScriptPath = "database\users-permissions-schema.sql"
)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Running SQL Script: $ScriptPath" -ForegroundColor Cyan
Write-Host "Server: $Server" -ForegroundColor Cyan
Write-Host "Database: $Database" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Read the SQL script
    if (-not (Test-Path $ScriptPath)) {
        throw "Script file not found: $ScriptPath"
    }
    
    $sqlScript = Get-Content $ScriptPath -Raw
    Write-Host "✓ Script file loaded successfully" -ForegroundColor Green
    Write-Host ""
    
    # Create connection string
    $connectionString = "Server=tcp:$Server,1433;Initial Catalog=$Database;Persist Security Info=False;User ID=$Username;Password=$Password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
    
    # Create SQL connection
    Write-Host "Connecting to database..." -ForegroundColor Yellow
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    Write-Host "✓ Connected to database successfully" -ForegroundColor Green
    Write-Host ""
    
    # Split script by GO statements
    $batches = $sqlScript -split '\r?\nGO\r?\n'
    $batchCount = 0
    $totalBatches = $batches.Count
    
    Write-Host "Executing $totalBatches SQL batches..." -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($batch in $batches) {
        $batch = $batch.Trim()
        if ($batch -ne "") {
            $batchCount++
            Write-Host "[$batchCount/$totalBatches] Executing batch..." -ForegroundColor Cyan
            
            $command = $connection.CreateCommand()
            $command.CommandText = $batch
            $command.CommandTimeout = 60
            
            try {
                $result = $command.ExecuteNonQuery()
                Write-Host "  ✓ Success ($result rows affected)" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠ Warning: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "✓ Script execution completed!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Verify the table was created
    Write-Host "Verifying Users table..." -ForegroundColor Yellow
    $verifyCommand = $connection.CreateCommand()
    $verifyCommand.CommandText = "SELECT COUNT(*) as UserCount FROM Users"
    $reader = $verifyCommand.ExecuteReader()
    
    if ($reader.Read()) {
        $userCount = $reader["UserCount"]
        Write-Host "✓ Users table exists with $userCount users" -ForegroundColor Green
    }
    $reader.Close()
    
    # Show the admin users
    Write-Host ""
    Write-Host "Initial admin users:" -ForegroundColor Yellow
    $adminCommand = $connection.CreateCommand()
    $adminCommand.CommandText = "SELECT Email, Role, Status FROM Users WHERE Role = 'Admin' ORDER BY Email"
    $reader = $adminCommand.ExecuteReader()
    
    while ($reader.Read()) {
        $email = $reader["Email"]
        $role = $reader["Role"]
        $status = $reader["Status"]
        Write-Host "  • $email - $role ($status)" -ForegroundColor Cyan
    }
    $reader.Close()
    
    $connection.Close()
    
    Write-Host ""
    Write-Host "✓ Database setup complete!" -ForegroundColor Green
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Red
    Write-Host $_.Exception.StackTrace -ForegroundColor Red
    exit 1
}
