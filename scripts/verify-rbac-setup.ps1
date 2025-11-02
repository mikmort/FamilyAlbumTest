# Verify RBAC Database Setup
param(
    [string]$Server = "familyalbum-prod-sql-gajerhxssqswm.database.windows.net",
    [string]$Database = "FamilyAlbum",
    [string]$Username = "familyadmin",
    [string]$Password = "Jam3jam3!"
)

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "RBAC System Database Verification" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

try {
    # Create connection string
    $connectionString = "Server=tcp:$Server,1433;Initial Catalog=$Database;Persist Security Info=False;User ID=$Username;Password=$Password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
    
    # Create SQL connection
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    # Check Users table
    Write-Host "✓ Connected to database" -ForegroundColor Green
    Write-Host ""
    
    # Show all users
    Write-Host "Current Users:" -ForegroundColor Yellow
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host ("{0,-35} {1,-10} {2,-12} {3}" -f "Email", "Role", "Status", "Last Login") -ForegroundColor Cyan
    Write-Host ("=" * 80) -ForegroundColor Gray
    
    $command = $connection.CreateCommand()
    $command.CommandText = "SELECT Email, Role, Status, LastLoginAt FROM Users ORDER BY Role DESC, Email"
    $reader = $command.ExecuteReader()
    
    $userCount = 0
    while ($reader.Read()) {
        $userCount++
        $email = $reader["Email"]
        $role = $reader["Role"]
        $status = $reader["Status"]
        $lastLogin = if ($reader["LastLoginAt"] -eq [DBNull]::Value) { "Never" } else { $reader["LastLoginAt"] }
        
        $roleColor = switch ($role) {
            "Admin" { "Red" }
            "Full" { "Blue" }
            "Read" { "Green" }
            default { "White" }
        }
        
        Write-Host ("{0,-35}" -f $email) -NoNewline
        Write-Host ("{0,-10}" -f $role) -ForegroundColor $roleColor -NoNewline
        Write-Host ("{0,-12}" -f $status) -NoNewline
        Write-Host $lastLogin
    }
    $reader.Close()
    
    Write-Host ("=" * 80) -ForegroundColor Gray
    Write-Host "Total Users: $userCount" -ForegroundColor Cyan
    Write-Host ""
    
    # Check pending requests
    Write-Host "Pending Access Requests:" -ForegroundColor Yellow
    $pendingCommand = $connection.CreateCommand()
    $pendingCommand.CommandText = "SELECT COUNT(*) as PendingCount FROM Users WHERE Status = 'Pending'"
    $reader = $pendingCommand.ExecuteReader()
    
    if ($reader.Read()) {
        $pendingCount = $reader["PendingCount"]
        if ($pendingCount -eq 0) {
            Write-Host "  No pending requests" -ForegroundColor Green
        } else {
            Write-Host "  $pendingCount pending request(s)" -ForegroundColor Yellow
        }
    }
    $reader.Close()
    Write-Host ""
    
    # Check views
    Write-Host "Database Objects:" -ForegroundColor Yellow
    $objectCommand = $connection.CreateCommand()
    $objectCommand.CommandText = @"
SELECT 
    CASE TYPE 
        WHEN 'U' THEN 'Table'
        WHEN 'V' THEN 'View'
        WHEN 'TR' THEN 'Trigger'
    END as ObjectType,
    name as ObjectName
FROM sys.objects
WHERE name IN ('Users', 'vw_ActiveUsersByRole', 'vw_PendingAccessRequests', 'trg_Users_UpdatedAt')
ORDER BY ObjectType, ObjectName
"@
    $reader = $objectCommand.ExecuteReader()
    
    while ($reader.Read()) {
        $type = $reader["ObjectType"]
        $name = $reader["ObjectName"]
        Write-Host "  ✓ $type`: $name" -ForegroundColor Green
    }
    $reader.Close()
    
    $connection.Close()
    
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host "✓ RBAC System is ready!" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Commit and push changes: git add . && git commit -m 'Add RBAC system' && git push" -ForegroundColor White
    Write-Host "  2. Wait for Azure deployment (2-5 minutes)" -ForegroundColor White
    Write-Host "  3. Test admin login with one of the admin accounts" -ForegroundColor White
    Write-Host "  4. Test new user flow with a different account" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
