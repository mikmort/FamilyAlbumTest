# Query database to see what's stored for Devorah's Wedding photos
$serverName = "familyalbum-prod-sql-gajerhxssqswm.database.windows.net"
$databaseName = "FamilyAlbum"
$username = "familyadmin"

Write-Host "Enter SQL password: " -NoNewline
$password = Read-Host -AsSecureString
$plaintextPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password))

$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$plaintextPassword;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    Write-Host "`nQuerying database for Devorah's Wedding photos..." -ForegroundColor Cyan
    
    $query = @"
SELECT TOP 10
    PFileDirectory,
    PFileName,
    CONCAT(PFileDirectory, '/', PFileName) as ConstructedPath
FROM dbo.Pictures
WHERE PFileDirectory LIKE '%Devorah%'
ORDER BY PFileName
"@
    
    $command = New-Object System.Data.SqlClient.SqlCommand($query, $connection)
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    Write-Host "`nFirst 10 records:" -ForegroundColor Yellow
    $dataset.Tables[0] | Format-Table -AutoSize
    
    Write-Host "`nLooking for specific file..." -ForegroundColor Yellow
    $query2 = @"
SELECT 
    PFileDirectory,
    PFileName,
    CONCAT(PFileDirectory, '/', PFileName) as ConstructedPath
FROM dbo.Pictures
WHERE PFileName LIKE '%025%' AND PFileDirectory LIKE '%Devorah%'
"@
    
    $command2 = New-Object System.Data.SqlClient.SqlCommand($query2, $connection)
    $adapter2 = New-Object System.Data.SqlClient.SqlDataAdapter($command2)
    $dataset2 = New-Object System.Data.DataSet
    $adapter2.Fill($dataset2) | Out-Null
    
    Write-Host "`nFile with '025' in name:" -ForegroundColor Yellow
    $dataset2.Tables[0] | Format-Table -AutoSize
    
    $connection.Close()
} catch {
    Write-Host "Error: $_" -ForegroundColor Red
}
