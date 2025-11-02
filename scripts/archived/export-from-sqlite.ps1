# ============================================
# EXPORT DATA FROM SQLITE
# ============================================
# This script exports data from FamilyAlbum.db SQLite database to CSV files
# for re-import into Azure SQL with preserved IDs
#
# Usage: .\export-from-sqlite.ps1

$sqlitePath = "C:\Family Album\FamilyAlbum.db"
$outputDir = "C:\Temp"

# Verify SQLite database exists
if (-not (Test-Path $sqlitePath)) {
    Write-Error "SQLite database not found: $sqlitePath"
    exit 1
}

# Create output directory if it doesn't exist
if (-not (Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "Exporting from SQLite database: $sqlitePath"
Write-Host "Output directory: $outputDir"

# Check if sqlite3.exe is available
$sqlite3 = "sqlite3"
$sqliteTest = & $sqlite3 --version 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "sqlite3.exe not found in PATH. Please install SQLite3 or add it to PATH."
    exit 1
}

Write-Host "`nStarting export..."

# Export People (neType='N')
Write-Host "Exporting people..."
$peopleQuery = @"
.headers on
.mode csv
.output $outputDir\people_export.csv
SELECT ID, neName, neRelation, 'N', neDateLastModified, neCount 
FROM NameEvent 
WHERE neType = 'N'
ORDER BY ID;
.output stdout
"@

$peopleQuery | & $sqlite3 $sqlitePath
if ($LASTEXITCODE -eq 0) {
    $count = (Get-Content "$outputDir\people_export.csv" | Measure-Object -Line).Lines - 1
    Write-Host "✓ Exported $count people"
} else {
    Write-Error "Failed to export people"
    exit 1
}

# Export Events (neType='E')
Write-Host "Exporting events..."
$eventsQuery = @"
.headers on
.mode csv
.output $outputDir\events_export.csv
SELECT ID, neName, neRelation, 'E', neDateLastModified, neCount 
FROM NameEvent 
WHERE neType = 'E'
ORDER BY ID;
.output stdout
"@

$eventsQuery | & $sqlite3 $sqlitePath
if ($LASTEXITCODE -eq 0) {
    $count = (Get-Content "$outputDir\events_export.csv" | Measure-Object -Line).Lines - 1
    Write-Host "✓ Exported $count events"
} else {
    Write-Error "Failed to export events"
    exit 1
}

# Export Pictures
Write-Host "Exporting pictures..."
$picturesQuery = @"
.headers on
.mode csv
.output $outputDir\pictures_export.csv
SELECT 
    PFileName, 
    PFileDirectory, 
    PDescription, 
    PHeight, 
    PWidth, 
    PMonth, 
    PYear, 
    PPeopleList, 
    PNameCount, 
    PType, 
    PTime, 
    PDateEntered, 
    PLastModifiedDate, 
    PReviewed, 
    PSoundFile 
FROM Pictures
ORDER BY PFileName;
.output stdout
"@

$picturesQuery | & $sqlite3 $sqlitePath
if ($LASTEXITCODE -eq 0) {
    $count = (Get-Content "$outputDir\pictures_export.csv" | Measure-Object -Line).Lines - 1
    Write-Host "✓ Exported $count pictures"
} else {
    Write-Error "Failed to export pictures"
    exit 1
}

# Export NamePhoto associations
Write-Host "Exporting photo associations..."
$namePhotoQuery = @"
.headers on
.mode csv
.output $outputDir\namephoto_export.csv
SELECT npID, npFileName, npPosition 
FROM NamePhoto
ORDER BY npFileName, npID;
.output stdout
"@

$namePhotoQuery | & $sqlite3 $sqlitePath
if ($LASTEXITCODE -eq 0) {
    $count = (Get-Content "$outputDir\namephoto_export.csv" | Measure-Object -Line).Lines - 1
    Write-Host "✓ Exported $count photo associations"
} else {
    Write-Error "Failed to export photo associations"
    exit 1
}

Write-Host "`n=== Export Complete ==="
Write-Host "Files created:"
Write-Host "  - $outputDir\people_export.csv"
Write-Host "  - $outputDir\events_export.csv"
Write-Host "  - $outputDir\pictures_export.csv"
Write-Host "  - $outputDir\namephoto_export.csv"

Write-Host "`nNext steps:"
Write-Host "1. Upload these CSV files to Azure or keep them accessible"
Write-Host "2. Run the SQL script: reimport-with-identity-preservation.sql"
Write-Host "3. Make sure the paths in the SQL script match the CSV file locations"
