# SQLite to Azure SQL Migration Script v4 - Simplified
param(
    [string]$SqliteDbPath = "C:\Users\mikmort\Downloads\FamilyAlbum.db"
)

Import-Module SqlServer -ErrorAction Stop

# Load .env.local
$envPath = ".env.local"
$config = @{}
Get-Content $envPath | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.+)$') {
        $config[$matches[1].Trim()] = $matches[2].Trim()
    }
}

$sqlServer = $config['AZURE_SQL_SERVER']
$sqlDatabase = $config['AZURE_SQL_DATABASE']
$sqlUser = $config['AZURE_SQL_USER']
$sqlPassword = $config['AZURE_SQL_PASSWORD']

Write-Output "=== SQLite to Azure SQL Migration ==="
Write-Output "Source: $SqliteDbPath"
Write-Output "Target: $sqlServer/$sqlDatabase"
Write-Output ""

if (-not (Test-Path $SqliteDbPath)) {
    Write-Error "SQLite database not found"
    exit 1
}

$sqlite3Path = "$env:TEMP\sqlite3\sqlite3.exe"
$connectionString = "Server=$sqlServer;Database=$sqlDatabase;User Id=$sqlUser;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"

Write-Output "Testing Azure SQL connection..."
try {
    Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT @@VERSION" -ErrorAction Stop | Out-Null
    Write-Output "Connected to Azure SQL"
} catch {
    Write-Error "Failed to connect: $($_.Exception.Message)"
    exit 1
}

# Step 1: People
Write-Output ""
Write-Output "=== Step 1: Migrating People ==="
$peopleCsv = "$env:TEMP\NameEvent.csv"
$peopleQuery = ".headers on`n.mode csv`n.output $peopleCsv`nSELECT ID, neName, neRelation, neType, neDateLastModified, neCount FROM NameEvent ORDER BY ID;`n.quit"
$peopleQuery | & $sqlite3Path $SqliteDbPath

if (Test-Path $peopleCsv) {
    $peopleData = Import-Csv $peopleCsv
    Write-Output "Found $($peopleData.Count) people"
    
    $migratedCount = 0
    foreach ($person in $peopleData) {
        try {
                $query = "INSERT INTO NameEvent (neName, neRelation, neType, neDateLastModified, neCount) VALUES ('$($person.neName.Replace("'", "''"))', $(if ($person.neRelation) { "'$($person.neRelation.Replace("'", "''"))'" } else { 'NULL' }), $(if ($person.neType) { "'$($person.neType.Replace("'", "''"))'" } else { 'NULL' }), $(if ($person.neDateLastModified) { "'$($person.neDateLastModified)'" } else { 'NULL' }), $($person.neCount))"
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $query
            $migratedCount++
            
            if ($migratedCount % 100 -eq 0) {
                Write-Output "  Migrated $migratedCount people..."
            }
        } catch {
            Write-Warning "Failed to migrate person '$($person.neName)': $($_.Exception.Message)"
        }
    }
    Write-Output "Migrated $migratedCount / $($peopleData.Count) people"
}

# Step 2: Pictures
Write-Output ""
Write-Output "=== Step 2: Migrating Pictures ==="
$picturesCsv = "$env:TEMP\Pictures.csv"
$picturesQuery = ".headers on`n.mode csv`n.output $picturesCsv`nSELECT PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount FROM Pictures ORDER BY PfileName;`n.quit"
$picturesQuery | & $sqlite3Path $SqliteDbPath

if (Test-Path $picturesCsv) {
    $picturesData = Import-Csv $picturesCsv
    Write-Output "Found $($picturesData.Count) pictures"
    
    $migratedCount = 0
    foreach ($picture in $picturesData) {
        try {
            $pDesc = if ($picture.PDescription) { "'$($picture.PDescription.Replace("'", "''"))'" } else { 'NULL' }
            $pDir = if ($picture.PfileDirectory) { "'$($picture.PfileDirectory.Replace("'", "''"))'" } else { 'NULL' }
            $pPeople = if ($picture.PPeopleList) { "'$($picture.PPeopleList.Replace("'", "''"))'" } else { 'NULL' }
            $pDateEntered = if ($picture.PDateEntered) { "'$($picture.PDateEntered)'" } else { 'NULL' }
            $pLastMod = if ($picture.PLastModifiedDate) { "'$($picture.PLastModifiedDate)'" } else { 'NULL' }
            
            $query = "INSERT INTO Pictures (PFileName, PFileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PNameCount) VALUES ('$($picture.PfileName.Replace("'", "''"))', $pDir, $pDesc, $(if ($picture.PHeight) { $picture.PHeight } else { 'NULL' }), $(if ($picture.PWidth) { $picture.PWidth } else { 'NULL' }), $pPeople, $(if ($picture.PMonth) { $picture.PMonth } else { 'NULL' }), $(if ($picture.PYear) { $picture.PYear } else { 'NULL' }), $(if ($picture.PSoundFile) { "'$($picture.PSoundFile.Replace("'", "''"))'" } else { 'NULL' }), $pDateEntered, $(if ($picture.PType) { $picture.PType } else { 'NULL' }), $pLastMod, $(if ($picture.PReviewed -eq '1') { 1 } else { 0 }), $(if ($picture.PNameCount) { $picture.PNameCount } else { 0 }))"
            
            Invoke-Sqlcmd -ConnectionString $connectionString -Query $query
            $migratedCount++
            
            if ($migratedCount % 100 -eq 0) {
                Write-Output "  Migrated $migratedCount pictures..."
            }
        } catch {
            Write-Warning "Failed to migrate picture '$($picture.PfileName)': $($_.Exception.Message)"
        }
    }
    Write-Output "Migrated $migratedCount / $($picturesData.Count) pictures"
}

# Step 3: Photo Tags
Write-Output ""
Write-Output "=== Step 3: Migrating Photo Tags ==="

# Get Azure SQL ID mapping
$nameIdMapping = @{}
$azureNames = Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT ID, neName FROM NameEvent"
foreach ($name in $azureNames) {
    $nameIdMapping[$name.neName] = $name.ID
}

# Get SQLite ID to Name mapping
$sqliteIdToName = @{}
$sqlitePeople = Import-Csv $peopleCsv
foreach ($person in $sqlitePeople) {
    $sqliteIdToName[$person.ID] = $person.neName
}

$tagsCsv = "$env:TEMP\NamePhoto.csv"
$tagsQuery = ".headers on`n.mode csv`n.output $tagsCsv`nSELECT npId, npFilename FROM NamePhoto ORDER BY npId, npFilename;`n.quit"
$tagsQuery | & $sqlite3Path $SqliteDbPath

if (Test-Path $tagsCsv) {
    $tagsData = Import-Csv $tagsCsv
    Write-Output "Found $($tagsData.Count) photo tags"
    
    $migratedCount = 0
    foreach ($tag in $tagsData) {
        try {
            $personName = $sqliteIdToName[$tag.npId]
            $azureNameId = $nameIdMapping[$personName]
            
            if ($azureNameId) {
                $query = "INSERT INTO NamePhoto (npID, npFileName) VALUES ($azureNameId, '$($tag.npFilename.Replace("'", "''"))')"
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $query
                $migratedCount++
                
                if ($migratedCount % 500 -eq 0) {
                    Write-Output "  Migrated $migratedCount tags..."
                }
            }
        } catch {
            Write-Warning "Failed to migrate tag: $($_.Exception.Message)"
        }
    }
    Write-Output "Migrated $migratedCount / $($tagsData.Count) photo tags"
}

Write-Output ""
Write-Output "=== Migration Complete ==="
Write-Output "Data migration completed successfully!"
