# Script to fix database filenames to match blob storage
# This script will:
# 1. Get all blob names from Azure Storage
# 2. Get all filenames from the database
# 3. Try to match corrupted filenames (spaces/apostrophes removed) to actual blob names
# 4. Update the database with correct filenames

$storageAccount = "famprodgajerhxssqswm"
$storageKey = $env:AZURE_STORAGE_KEY  # Set via environment variable
$containerName = "family-album-media"

$serverName = "familyalbum-prod-sql-gajerhxssqswm.database.windows.net"
$databaseName = "FamilyAlbum"
$username = "familyadmin"
$password = $env:SQL_PASSWORD  # Set via environment variable

if (-not $storageKey) {
    Write-Error "Please set AZURE_STORAGE_KEY environment variable"
    exit 1
}

if (-not $password) {
    Write-Error "Please set SQL_PASSWORD environment variable"
    exit 1
}

$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# Add Azure CLI to path
$env:PATH += ";C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin"

Write-Output "Step 1: Getting all blob names from Azure Storage..."
$blobsJson = az storage blob list --account-name $storageAccount --account-key $storageKey --container-name $containerName --output json
$blobs = $blobsJson | ConvertFrom-Json
Write-Output "Found $($blobs.Count) blobs in storage"

# Create a lookup table: normalized name -> actual blob name
$blobLookup = @{}
foreach ($blob in $blobs) {
    $blobName = $blob.name
    # Normalize: remove spaces, apostrophes, and convert to lowercase for matching
    $normalized = $blobName -replace "[\s']", "" -replace "%27", "" -replace "%20", ""
    $normalized = $normalized.ToLower()
    
    # Also try with forward slash converted to backslash
    $normalizedWithBackslash = $normalized -replace "/", "\"
    
    $blobLookup[$normalized] = $blobName
    $blobLookup[$normalizedWithBackslash] = $blobName
}

Write-Output ""
Write-Output "Step 2: Getting all filenames from database..."

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    # Get all pictures with their current paths
    $query = @"
SELECT 
    PFileName,
    PFileDirectory
FROM Pictures
WHERE PFileName IS NOT NULL
"@
    
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    $pictures = $dataset.Tables[0]
    Write-Output "Found $($pictures.Rows.Count) pictures in database"
    
    Write-Output ""
    Write-Output "Step 3: Matching and updating filenames..."
    Write-Output ""
    
    $updateCount = 0
    $noMatchCount = 0
    $alreadyCorrectCount = 0
    
    foreach ($row in $pictures.Rows) {
        $dbFileName = $row["PFileName"]
        $dbDirectory = $row["PFileDirectory"]
        
        # Normalize the database filename for matching
        $normalizedDb = $dbFileName -replace "[\s']", "" -replace "%27", "" -replace "%20", ""
        $normalizedDb = $normalizedDb.ToLower()
        
        # Check if we have a match in blob storage
        if ($blobLookup.ContainsKey($normalizedDb)) {
            $actualBlobName = $blobLookup[$normalizedDb]
            
            # Convert blob path (forward slash) to database format (backslash)
            $correctDbFileName = $actualBlobName -replace "/", "\"
            
            # Extract directory from the blob path
            if ($correctDbFileName -match "^(.+)\\[^\\]+$") {
                $correctDirectory = $matches[1]
            } else {
                $correctDirectory = ""
            }
            
            # Check if update is needed
            if ($dbFileName -ne $correctDbFileName -or $dbDirectory -ne $correctDirectory) {
                Write-Output "UPDATING: '$dbFileName' -> '$correctDbFileName'"
                Write-Output "  Directory: '$dbDirectory' -> '$correctDirectory'"
                
                # Update the database
                $updateQuery = @"
UPDATE Pictures
SET PFileName = @newFileName,
    PFileDirectory = @newDirectory
WHERE PFileName = @oldFileName
"@
                
                $updateCommand = $connection.CreateCommand()
                $updateCommand.CommandText = $updateQuery
                $updateCommand.Parameters.AddWithValue("@newFileName", $correctDbFileName) | Out-Null
                $updateCommand.Parameters.AddWithValue("@newDirectory", $correctDirectory) | Out-Null
                $updateCommand.Parameters.AddWithValue("@oldFileName", $dbFileName) | Out-Null
                
                $rowsAffected = $updateCommand.ExecuteNonQuery()
                $updateCount += $rowsAffected
                Write-Output "  Updated $rowsAffected row(s)"
                Write-Output ""
            } else {
                $alreadyCorrectCount++
            }
        } else {
            Write-Output "NO MATCH: '$dbFileName' (not found in blob storage)"
            $noMatchCount++
        }
    }
    
    Write-Output ""
    Write-Output "=== SUMMARY ==="
    Write-Output "Total pictures in database: $($pictures.Rows.Count)"
    Write-Output "Updated: $updateCount"
    Write-Output "Already correct: $alreadyCorrectCount"
    Write-Output "No match in blob storage: $noMatchCount"
    
    $connection.Close()
    
} catch {
    Write-Output "Error: $_"
    Write-Output $_.Exception.Message
} finally {
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
}

Write-Output ""
Write-Output "Done!"
