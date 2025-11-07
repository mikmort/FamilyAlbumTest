# Update database for the 14 MOV files we just converted to MP4
param(
    [string]$Server = "famprod-sql-gajerhxssqswm.database.windows.net",
    [string]$Database = "FamilyAlbumDB",
    [string]$Username = "famalbum"
)

$password = $env:AZURE_SQL_PASSWORD
if (-not $password) {
    Write-Host "❌ AZURE_SQL_PASSWORD environment variable not set" -ForegroundColor Red
    exit 1
}

# Files that were converted
$files = @(
    'On Location/FloridaJan2003/P1230126.MOV',
    'On Location/Milwaukee Aug 2003/P8240098.MOV',
    'On Location/Milwaukee Feb 2003/P2240107.MOV',
    'On Location/Charlottesville Summer 2011/MVI_0213.MOV',
    'On Location/Milwaukee Feb 2003/P2220052.MOV',
    'On Location/Florida2002/Rachels Birthday/P7190146.MOV',
    'On Location/Milwaukee Feb 2003/P2240117.MOV',
    'On Location/Charlottesville Summer 2011/MVI_0219.MOV',
    'On Location/Milwaukee 2002/P3170007.MOV',
    'On Location/Milwaukee Feb 2003/P2200032.MOV',
    'On Location/Milwaukee Feb 2003/P2210046.MOV',
    'On Location/Milwaukee Aug 2003/P8240012.MOV',
    'On Location/Milwaukee Feb 2003/P2210044.MOV',
    'On Location/Milwaukee Aug 2003/P8240014.MOV'
)

Write-Host "Connecting to database..." -ForegroundColor Cyan

# Build connection string
$connectionString = "Server=tcp:$Server,1433;Initial Catalog=$Database;Persist Security Info=False;User ID=$Username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    # Create SQL connection
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    Write-Host "✅ Connected to database" -ForegroundColor Green
    
    $updated = 0
    
    # Disable foreign key constraint temporarily
    $disableFK = "ALTER TABLE NamePhoto NOCHECK CONSTRAINT FK__NamePhoto__npFil__00200768"
    $command = $connection.CreateCommand()
    $command.CommandText = $disableFK
    $command.ExecuteNonQuery() | Out-Null
    Write-Host "✅ Disabled foreign key constraint" -ForegroundColor Green
    
    foreach ($file in $files) {
        $newFile = $file -replace '\.MOV$', '.mp4'
        
        try {
            # Update Pictures table
            $query1 = "UPDATE Pictures SET PFileName = @newFile WHERE PFileName = @oldFile"
            $command1 = $connection.CreateCommand()
            $command1.CommandText = $query1
            $command1.Parameters.AddWithValue("@newFile", $newFile) | Out-Null
            $command1.Parameters.AddWithValue("@oldFile", $file) | Out-Null
            $picturesRows = $command1.ExecuteNonQuery()
            
            # Update NamePhoto table
            $query2 = "UPDATE NamePhoto SET npFileName = @newFile WHERE npFileName = @oldFile"
            $command2 = $connection.CreateCommand()
            $command2.CommandText = $query2
            $command2.Parameters.AddWithValue("@newFile", $newFile) | Out-Null
            $command2.Parameters.AddWithValue("@oldFile", $file) | Out-Null
            $namePhotoRows = $command2.ExecuteNonQuery()
            
            if ($picturesRows -gt 0 -or $namePhotoRows -gt 0) {
                Write-Host "✅ Updated: $file -> $newFile (Pictures: $picturesRows, NamePhoto: $namePhotoRows)" -ForegroundColor Green
                $updated++
            } else {
                Write-Host "⚠️  Not found: $file" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "❌ Error updating $file : $_" -ForegroundColor Red
        }
    }
    
    # Re-enable foreign key constraint
    $enableFK = "ALTER TABLE NamePhoto WITH CHECK CHECK CONSTRAINT FK__NamePhoto__npFil__00200768"
    $command = $connection.CreateCommand()
    $command.CommandText = $enableFK
    $command.ExecuteNonQuery() | Out-Null
    Write-Host "✅ Re-enabled foreign key constraint" -ForegroundColor Green
    
    $connection.Close()
    
    Write-Host "`n$('='*80)" -ForegroundColor Cyan
    Write-Host "DATABASE UPDATE COMPLETE" -ForegroundColor Cyan
    Write-Host "$('='*80)" -ForegroundColor Cyan
    Write-Host "Updated $updated out of $($files.Count) files" -ForegroundColor Green
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}
