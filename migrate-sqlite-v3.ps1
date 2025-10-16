# SQLite to Azure SQL Migration Script v3 - With Corrected Schema Mapping
# This script migrates data from the local SQLite database to Azure SQL

param(
    [string]$SqliteDbPath = "C:\Users\mikmort\Downloads\FamilyAlbum.db",
    [switch]$DryRun = $false
)

# Import required modules
Import-Module SqlServer -ErrorAction Stop

# Load configuration from .env.local
$envPath = ".env.local"
if (-not (Test-Path $envPath)) {
    Write-Error ".env.local file not found"
    exit 1
}

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

Write-Host "=== SQLite to Azure SQL Migration ===" -ForegroundColor Cyan
Write-Host "Source: $SqliteDbPath" -ForegroundColor White
Write-Host "Target: $sqlServer/$sqlDatabase" -ForegroundColor White
Write-Host "Dry Run: $DryRun" -ForegroundColor White
Write-Host ""

# Verify SQLite database exists
if (-not (Test-Path $SqliteDbPath)) {
    Write-Error "SQLite database not found at: $SqliteDbPath"
    exit 1
}

# SQLite executable path
$sqlite3Path = "$env:TEMP\sqlite3\sqlite3.exe"
if (-not (Test-Path $sqlite3Path)) {
    Write-Host "Downloading sqlite3.exe..." -ForegroundColor Yellow
    $url = "https://www.sqlite.org/2024/sqlite-tools-win-x64-3460100.zip"
    $zipPath = "$env:TEMP\sqlite-tools.zip"
    $extractPath = "$env:TEMP\sqlite3"
    
    Invoke-WebRequest -Uri $url -OutFile $zipPath
    Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
    
    # Move sqlite3.exe to root of extract path
    $exePath = Get-ChildItem -Path $extractPath -Filter "sqlite3.exe" -Recurse | Select-Object -First 1
    if ($exePath -and $exePath.FullName -ne $sqlite3Path) {
        Move-Item -Path $exePath.FullName -Destination $sqlite3Path -Force
    }
}

# Azure SQL connection string
$connectionString = "Server=$sqlServer;Database=$sqlDatabase;User Id=$sqlUser;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"

Write-Host "Testing Azure SQL connection..." -ForegroundColor Yellow
try {
    $testQuery = "SELECT @@VERSION"
    $result = Invoke-Sqlcmd -ConnectionString $connectionString -Query $testQuery -ErrorAction Stop
    Write-Host "✓ Connected to Azure SQL successfully" -ForegroundColor Green
    Write-Host "  SQL Server: $($result.Column1.Split([Environment]::NewLine)[0])" -ForegroundColor Gray
} catch {
    Write-Error "Failed to connect to Azure SQL: $($_.Exception.Message)"
    exit 1
}

# Function to export SQLite table to CSV
function Export-SQLiteTable {
    param(
        [string]$TableName,
        [string]$Query
    )
    
    $csvPath = "$env:TEMP\$TableName.csv"
    
    # Export to CSV using sqlite3
    $sqliteQuery = ".headers on`n.mode csv`n.output $csvPath`n$Query`n.quit"
    $sqliteQuery | & $sqlite3Path $SqliteDbPath
    
    if (Test-Path $csvPath) {
        Write-Host "✓ Exported $TableName to CSV" -ForegroundColor Green
        return $csvPath
    } else {
        Write-Error "Failed to export $TableName"
        return $null
    }
}

# Migration Step 1: Migrate People (NameEvent -> NameEvent)
Write-Host "`n=== Step 1: Migrating People ===" -ForegroundColor Cyan

# SQLite Schema: ID, neName, neRelation, neType, neDateLastModified, neCount
# Azure SQL Schema: NameID (identity), NameName, NameRelation, NameType, NameDateLastModified, neCount

$peopleQuery = "SELECT ID, neName, neRelation, neType, neDateLastModified, neCount FROM NameEvent ORDER BY ID"
$peopleCsv = Export-SQLiteTable -TableName "NameEvent" -Query $peopleQuery

if ($peopleCsv) {
    $peopleData = Import-Csv $peopleCsv
    Write-Host "Found $($peopleData.Count) people to migrate" -ForegroundColor White
    
    if (-not $DryRun) {
        $migratedCount = 0
        foreach ($person in $peopleData) {
            try {
                # Map SQLite columns to Azure SQL columns
                $insertQuery = "INSERT INTO NameEvent (NameName, NameRelation, NameType, NameDateLastModified, neCount) VALUES (@neName, @neRelation, @neType, @neDateLastModified, @neCount)"
                $params = @{
                    neName = $person.neName
                    neRelation = if ($person.neRelation) { $person.neRelation } else { [DBNull]::Value }
                    neType = if ($person.neType) { $person.neType } else { [DBNull]::Value }
                    neDateLastModified = if ($person.neDateLastModified) { $person.neDateLastModified } else { [DBNull]::Value }
                    neCount = if ($person.neCount) { [int]$person.neCount } else { 0 }
                }
                
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $insertQuery -Variable ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
                $migratedCount++
                
                if ($migratedCount % 100 -eq 0) {
                    Write-Host "  Migrated $migratedCount people..." -ForegroundColor Gray
                }
            } catch {
                Write-Warning "Failed to migrate person '$($person.neName)': $($_.Exception.Message)"
            }
        }
        Write-Host "✓ Migrated $migratedCount / $($peopleData.Count) people" -ForegroundColor Green
    }
}

# Migration Step 2: Migrate Pictures (Pictures -> Pictures)
Write-Host "`n=== Step 2: Migrating Pictures ===" -ForegroundColor Cyan

# SQLite Schema: PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PThumbnail, PNameCount
# Azure SQL Schema: PFileName (PK), PDirectory, PDescription, PEventDate, PHeight, PWidth, PPeopleList, PMonth, PYear, PHasSound, PDateEntered, PType, PDateLastModified, PIsReviewed, PThumbnail, PNameCount

$picturesQuery = "SELECT PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount FROM Pictures ORDER BY PfileName"

$picturesCsv = Export-SQLiteTable -TableName "Pictures" -Query $picturesQuery

if ($picturesCsv) {
    $picturesData = Import-Csv $picturesCsv
    Write-Host "Found $($picturesData.Count) pictures to migrate" -ForegroundColor White
    
    if (-not $DryRun) {
        $migratedCount = 0
        foreach ($picture in $picturesData) {
            try {
                # Map SQLite columns to Azure SQL columns
                $insertQuery = "INSERT INTO Pictures (PFileName, PDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PHasSound, PDateEntered, PType, PDateLastModified, PIsReviewed, PNameCount) VALUES (@PfileName, @PfileDirectory, @PDescription, @PHeight, @PWidth, @PPeopleList, @PMonth, @PYear, @PSoundFile, @PDateEntered, @PType, @PLastModifiedDate, @PReviewed, @PNameCount)"
                
                $params = @{
                    PfileName = $picture.PfileName
                    PfileDirectory = if ($picture.PfileDirectory) { $picture.PfileDirectory } else { [DBNull]::Value }
                    PDescription = if ($picture.PDescription) { $picture.PDescription } else { [DBNull]::Value }
                    PHeight = if ($picture.PHeight) { [int]$picture.PHeight } else { [DBNull]::Value }
                    PWidth = if ($picture.PWidth) { [int]$picture.PWidth } else { [DBNull]::Value }
                    PPeopleList = if ($picture.PPeopleList) { $picture.PPeopleList } else { [DBNull]::Value }
                    PMonth = if ($picture.PMonth) { [int]$picture.PMonth } else { [DBNull]::Value }
                    PYear = if ($picture.PYear) { [int]$picture.PYear } else { [DBNull]::Value }
                    PSoundFile = if ($picture.PSoundFile -eq '1') { 1 } else { 0 }
                    PDateEntered = if ($picture.PDateEntered) { $picture.PDateEntered } else { [DBNull]::Value }
                    PType = if ($picture.PType) { [int]$picture.PType } else { [DBNull]::Value }
                    PLastModifiedDate = if ($picture.PLastModifiedDate) { $picture.PLastModifiedDate } else { [DBNull]::Value }
                    PReviewed = if ($picture.PReviewed -eq '1') { 1 } else { 0 }
                    PNameCount = if ($picture.PNameCount) { [int]$picture.PNameCount } else { 0 }
                }
                
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $insertQuery -Variable ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
                $migratedCount++
                
                if ($migratedCount % 100 -eq 0) {
                    Write-Host "  Migrated $migratedCount pictures..." -ForegroundColor Gray
                }
            } catch {
                Write-Warning "Failed to migrate picture '$($picture.PfileName)': $($_.Exception.Message)"
            }
        }
        Write-Host "✓ Migrated $migratedCount / $($picturesData.Count) pictures" -ForegroundColor Green
    }
}

# Migration Step 3: Migrate Photo Tags (NamePhoto -> NamePhoto)
Write-Host "`n=== Step 3: Migrating Photo Tags ===" -ForegroundColor Cyan

# SQLite Schema: npId, npFilename
# Azure SQL Schema: NamePhotoID (identity), NameID, PFileName

# First, we need to get the mapping of old NameEvent IDs to new Azure SQL NameIDs
$nameIdMapping = @{}
if (-not $DryRun) {
    $azureNames = Invoke-Sqlcmd -ConnectionString $connectionString -Query "SELECT NameID, NameName FROM NameEvent"
    foreach ($name in $azureNames) {
        $nameIdMapping[$name.NameName] = $name.NameID
    }
}

$tagsQuery = "SELECT npId, npFilename FROM NamePhoto ORDER BY npId, npFilename"
$tagsCsv = Export-SQLiteTable -TableName "NamePhoto" -Query $tagsQuery

if ($tagsCsv) {
    $tagsData = Import-Csv $tagsCsv
    Write-Host "Found $($tagsData.Count) photo tags to migrate" -ForegroundColor White
    
    if (-not $DryRun) {
        # Get NameEvent data to map IDs to names
        $sqliteNames = Import-Csv $peopleCsv
        $sqliteIdToName = @{}
        foreach ($person in $sqliteNames) {
            $sqliteIdToName[$person.ID] = $person.neName
        }
        
        $migratedCount = 0
        foreach ($tag in $tagsData) {
            try {
                # Map SQLite ID to person name, then to Azure SQL NameID
                $personName = $sqliteIdToName[$tag.npId]
                $azureNameId = $nameIdMapping[$personName]
                
                if ($azureNameId) {
                    $insertQuery = "INSERT INTO NamePhoto (NameID, PFileName) VALUES (@NameID, @PFileName)"
                    $params = @{
                        NameID = $azureNameId
                        PFileName = $tag.npFilename
                    }
                    
                    Invoke-Sqlcmd -ConnectionString $connectionString -Query $insertQuery -Variable ($params.GetEnumerator() | ForEach-Object { "$($_.Key)=$($_.Value)" })
                    $migratedCount++
                    
                    if ($migratedCount % 500 -eq 0) {
                        Write-Host "  Migrated $migratedCount tags..." -ForegroundColor Gray
                    }
                } else {
                    Write-Warning "Could not find Azure SQL NameID for person '$personName' (SQLite ID: $($tag.npId))"
                }
            } catch {
                Write-Warning "Failed to migrate tag for '$($tag.npFilename)': $($_.Exception.Message)"
            }
        }
        Write-Host "✓ Migrated $migratedCount / $($tagsData.Count) photo tags" -ForegroundColor Green
    }
}

Write-Host "`n=== Migration Complete ===" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "This was a dry run. No data was actually migrated." -ForegroundColor Yellow
} else {
    Write-Host "Data migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Verify data in Azure SQL Database" -ForegroundColor Gray
    Write-Host "2. Upload media files to Azure Blob Storage (40GB)" -ForegroundColor Gray
    Write-Host "3. Test the application at https://lively-glacier-02a77180f.2.azurestaticapps.net/" -ForegroundColor Gray
}
