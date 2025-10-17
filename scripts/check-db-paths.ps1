# Check what paths are in the database
$serverName = "familyalbum-prod-sql-gajerhxssqswm.database.windows.net"
$databaseName = "FamilyAlbum"
$username = "familyadmin"
$password = "Jam3jam3!"

$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# Query to search for the specific file
$query = @"
SELECT TOP 20
    PFileName,
    PFileDirectory
FROM Pictures
WHERE PFileName LIKE '%DevorahWedding.jpg%'
"@

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    Write-Host "Sample of database paths:" -ForegroundColor Cyan
    Write-Host ""
    
    $dataset.Tables[0] | Format-Table -AutoSize
    
    $connection.Close()
    
    Write-Host ""
    Write-Host "Column names:" -ForegroundColor Cyan
    $dataset.Tables[0].Columns | Select-Object ColumnName, DataType | Format-Table -AutoSize
    
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
} finally {
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
}
