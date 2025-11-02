# SQLite to Azure SQL Migration Script
# Migrates data from FamilyAlbum.db (SQLite) to Azure SQL Database

Write-Host "=== SQLite to Azure SQL Migration ===" -ForegroundColor Cyan
Write-Host ""

# SQLite database path
$sqliteDbPath = "C:\Users\mikmort\Downloads\FamilyAlbum.db"

if (-not (Test-Path $sqliteDbPath)) {
    Write-Host "Error: SQLite database not found at $sqliteDbPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found SQLite database: $sqliteDbPath" -ForegroundColor Green
Write-Host ""

# Load deployment info for Azure SQL connection
$deploymentInfoFile = Get-ChildItem "deployment-info-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $deploymentInfoFile) {
    Write-Host "Error: Could not find deployment info file" -ForegroundColor Red
    exit 1
}

$deploymentInfo = Get-Content $deploymentInfoFile.FullName -Raw

# Extract SQL connection details
$sqlServer = $null
$sqlDatabase = $null
$sqlUsername = $null
$sqlPassword = $null

if ($deploymentInfo -match 'SQL Server: (.+)') {
    $sqlServer = $Matches[1].Trim()
}
if ($deploymentInfo -match 'SQL Database: (.+)') {
    $sqlDatabase = $Matches[1].Trim()
}
if ($deploymentInfo -match 'SQL Username: (.+)') {
    $sqlUsername = $Matches[1].Trim()
}
if ($deploymentInfo -match 'SQL Password: (.+)') {
    $sqlPassword = $Matches[1].Trim()
}

Write-Host "Target Azure SQL Server: $sqlServer" -ForegroundColor White
Write-Host "Target Database: $sqlDatabase" -ForegroundColor White
Write-Host ""

# Install required modules
Write-Host "Checking required modules..." -ForegroundColor Yellow

if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

if (-not (Get-Module -ListAvailable -Name PSSQLite)) {
    Write-Host "Installing PSSQLite module..." -ForegroundColor Yellow
    Install-Module -Name PSSQLite -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer
Import-Module PSSQLite

Write-Host "Modules loaded successfully" -ForegroundColor Green
Write-Host ""

# Azure SQL connection string
$azureConnectionString = "Server=$sqlServer;Database=$sqlDatabase;User ID=$sqlUsername;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"

# Function to execute Azure SQL query
function Invoke-AzureSql {
    param (
        [string]$Query,
        [hashtable]$Parameters = @{}
    )
    
    try {
        $paramArray = @()
        foreach ($key in $Parameters.Keys) {
            $paramArray += "$key=$($Parameters[$key])"
        }
        
        Invoke-Sqlcmd -ConnectionString $azureConnectionString -Query $Query -Variable $paramArray -ErrorAction Stop
    } catch {
        Write-Host "  Error executing query: $($_.Exception.Message)" -ForegroundColor Red
        throw
    }
}

# Start migration
Write-Host "=== Starting Data Migration ===" -ForegroundColor Cyan
Write-Host ""

try {
    # 1. Migrate NameEvent (People)
    Write-Host "Step 1: Migrating People (NameEvent table)..." -ForegroundColor Yellow
    $people = Invoke-SqliteQuery -DataSource $sqliteDbPath -Query "SELECT * FROM NameEvent ORDER BY NameID"
    
    $peopleCount = 0
    foreach ($person in $people) {
        $query = @"
IF NOT EXISTS (SELECT 1 FROM dbo.NameEvent WHERE NameID = @NameID)
BEGIN
    SET IDENTITY_INSERT dbo.NameEvent ON;
    INSERT INTO dbo.NameEvent (NameID, NameLName, neCount)
    VALUES (@NameID, @NameLName, @neCount);
    SET IDENTITY_INSERT dbo.NameEvent OFF;
END
ELSE
BEGIN
    UPDATE dbo.NameEvent 
    SET NameLName = @NameLName, neCount = @neCount
    WHERE NameID = @NameID;
END
"@
        
        $params = @{
            NameID = $person.NameID
            NameLName = $person.NameLName
            neCount = if ($person.neCount) { $person.neCount } else { 0 }
        }
        
        Invoke-AzureSql -Query $query -Parameters $params
        $peopleCount++
        
        if ($peopleCount % 10 -eq 0) {
            Write-Host "  Processed $peopleCount people..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $peopleCount people" -ForegroundColor Green
    Write-Host ""

    # 2. Migrate Pictures
    Write-Host "Step 2: Migrating Pictures..." -ForegroundColor Yellow
    $pictures = Invoke-SqliteQuery -DataSource $sqliteDbPath -Query "SELECT * FROM Pictures ORDER BY PFileName"
    
    $picturesCount = 0
    foreach ($pic in $pictures) {
        $query = @"
IF NOT EXISTS (SELECT 1 FROM dbo.Pictures WHERE PFileName = @PFileName)
BEGIN
    INSERT INTO dbo.Pictures 
    (PFileName, PDirectory, PThumbUrl, PType, PWidth, PHeight, PVtime, PEventDate, PBlobUrl)
    VALUES 
    (@PFileName, @PDirectory, @PThumbUrl, @PType, @PWidth, @PHeight, @PVtime, @PEventDate, @PBlobUrl);
END
ELSE
BEGIN
    UPDATE dbo.Pictures
    SET PDirectory = @PDirectory, PThumbUrl = @PThumbUrl, PType = @PType,
        PWidth = @PWidth, PHeight = @PHeight, PVtime = @PVtime, 
        PEventDate = @PEventDate, PBlobUrl = @PBlobUrl
    WHERE PFileName = @PFileName;
END
"@
        
        $params = @{
            PFileName = $pic.PFileName
            PDirectory = if ($pic.PDirectory) { $pic.PDirectory } else { '' }
            PThumbUrl = if ($pic.PThumbUrl) { $pic.PThumbUrl } else { '' }
            PType = if ($pic.PType) { $pic.PType } else { 1 }
            PWidth = if ($pic.PWidth) { $pic.PWidth } else { 0 }
            PHeight = if ($pic.PHeight) { $pic.PHeight } else { 0 }
            PVtime = if ($pic.PVtime) { $pic.PVtime } else { 0 }
            PEventDate = if ($pic.PEventDate) { $pic.PEventDate } else { [DBNull]::Value }
            PBlobUrl = if ($pic.PBlobUrl) { $pic.PBlobUrl } else { '' }
        }
        
        Invoke-AzureSql -Query $query -Parameters $params
        $picturesCount++
        
        if ($picturesCount % 50 -eq 0) {
            Write-Host "  Processed $picturesCount pictures..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $picturesCount pictures" -ForegroundColor Green
    Write-Host ""

    # 3. Migrate NamePhoto (Photo Tags)
    Write-Host "Step 3: Migrating Photo Tags (NamePhoto table)..." -ForegroundColor Yellow
    $tags = Invoke-SqliteQuery -DataSource $sqliteDbPath -Query "SELECT * FROM NamePhoto"
    
    $tagsCount = 0
    foreach ($tag in $tags) {
        $query = @"
IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE PFileName = @PFileName AND NameID = @NameID)
BEGIN
    INSERT INTO dbo.NamePhoto (PFileName, NameID, npXPos, npYPos)
    VALUES (@PFileName, @NameID, @npXPos, @npYPos);
END
ELSE
BEGIN
    UPDATE dbo.NamePhoto
    SET npXPos = @npXPos, npYPos = @npYPos
    WHERE PFileName = @PFileName AND NameID = @NameID;
END
"@
        
        $params = @{
            PFileName = $tag.PFileName
            NameID = $tag.NameID
            npXPos = if ($tag.npXPos) { $tag.npXPos } else { 0 }
            npYPos = if ($tag.npYPos) { $tag.npYPos } else { 0 }
        }
        
        Invoke-AzureSql -Query $query -Parameters $params
        $tagsCount++
        
        if ($tagsCount % 100 -eq 0) {
            Write-Host "  Processed $tagsCount tags..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $tagsCount photo tags" -ForegroundColor Green
    Write-Host ""

    # 4. Migrate UnindexedFiles (if exists)
    Write-Host "Step 4: Checking for UnindexedFiles..." -ForegroundColor Yellow
    $unindexedExists = Invoke-SqliteQuery -DataSource $sqliteDbPath -Query "SELECT name FROM sqlite_master WHERE type='table' AND name='UnindexedFiles'"
    
    if ($unindexedExists) {
        $unindexed = Invoke-SqliteQuery -DataSource $sqliteDbPath -Query "SELECT * FROM UnindexedFiles"
        
        $unindexedCount = 0
        foreach ($file in $unindexed) {
            $query = @"
IF NOT EXISTS (SELECT 1 FROM dbo.UnindexedFiles WHERE uiFileName = @uiFileName)
BEGIN
    INSERT INTO dbo.UnindexedFiles 
    (uiFileName, uiDirectory, uiThumbUrl, uiType, uiWidth, uiHeight, uiVtime, uiStatus, uiBlobUrl)
    VALUES 
    (@uiFileName, @uiDirectory, @uiThumbUrl, @uiType, @uiWidth, @uiHeight, @uiVtime, @uiStatus, @uiBlobUrl);
END
"@
            
            $params = @{
                uiFileName = $file.uiFileName
                uiDirectory = if ($file.uiDirectory) { $file.uiDirectory } else { '' }
                uiThumbUrl = if ($file.uiThumbUrl) { $file.uiThumbUrl } else { '' }
                uiType = if ($file.uiType) { $file.uiType } else { 1 }
                uiWidth = if ($file.uiWidth) { $file.uiWidth } else { 0 }
                uiHeight = if ($file.uiHeight) { $file.uiHeight } else { 0 }
                uiVtime = if ($file.uiVtime) { $file.uiVtime } else { 0 }
                uiStatus = if ($file.uiStatus) { $file.uiStatus } else { 'N' }
                uiBlobUrl = if ($file.uiBlobUrl) { $file.uiBlobUrl } else { '' }
            }
            
            Invoke-AzureSql -Query $query -Parameters $params
            $unindexedCount++
        }
        Write-Host "  Migrated $unindexedCount unindexed files" -ForegroundColor Green
    } else {
        Write-Host "  No UnindexedFiles table found (skipping)" -ForegroundColor Gray
    }
    Write-Host ""

    # Summary
    Write-Host "=== Migration Summary ===" -ForegroundColor Cyan
    Write-Host "People:      $peopleCount" -ForegroundColor White
    Write-Host "Pictures:    $picturesCount" -ForegroundColor White
    Write-Host "Tags:        $tagsCount" -ForegroundColor White
    if ($unindexedExists) {
        Write-Host "Unindexed:   $unindexedCount" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Migration completed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Verify data in Azure SQL Database" -ForegroundColor White
    Write-Host "2. Upload media files to Azure Blob Storage (if needed)" -ForegroundColor White
    Write-Host "3. Test the application at: https://lively-glacier-02a77180f.2.azurestaticapps.net/" -ForegroundColor White

} catch {
    Write-Host ""
    Write-Host "Migration failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.ScriptStackTrace)" -ForegroundColor Red
    exit 1
}
