# SQLite to Azure SQL Migration Script (using System.Data.SQLite)
# Migrates data from FamilyAlbum.db to Azure SQL Database

Write-Host "=== SQLite to Azure SQL Migration ===" -ForegroundColor Cyan
Write-Host ""

# SQLite database path
$sqliteDbPath = "C:\Users\mikmort\Downloads\FamilyAlbum.db"

if (-not (Test-Path $sqliteDbPath)) {
    Write-Host "Error: SQLite database not found at $sqliteDbPath" -ForegroundColor Red
    exit 1
}

Write-Host "Found SQLite database: $sqliteDbPath" -ForegroundColor Green

# Load deployment info
$deploymentInfoFile = Get-ChildItem "deployment-info-*.txt" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $deploymentInfoFile) {
    Write-Host "Error: Could not find deployment info file" -ForegroundColor Red
    exit 1
}

$deploymentInfo = Get-Content $deploymentInfoFile.FullName -Raw

# Extract connection details
$sqlServer = if ($deploymentInfo -match 'SQL Server: (.+)') { $Matches[1].Trim() } else { $null }
$sqlDatabase = if ($deploymentInfo -match 'SQL Database: (.+)') { $Matches[1].Trim() } else { $null }
$sqlUsername = if ($deploymentInfo -match 'SQL Username: (.+)') { $Matches[1].Trim() } else { $null }
$sqlPassword = if ($deploymentInfo -match 'SQL Password: (.+)') { $Matches[1].Trim() } else { $null }

Write-Host "Target: $sqlServer / $sqlDatabase" -ForegroundColor White
Write-Host ""

# Install SqlServer module
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}
Import-Module SqlServer

# Download and load System.Data.SQLite
$sqliteNugetPath = "$env:USERPROFILE\.nuget\packages\system.data.sqlite.core\1.0.118\lib\netstandard2.0\System.Data.SQLite.dll"

if (-not (Test-Path $sqliteNugetPath)) {
    Write-Host "Downloading System.Data.SQLite..." -ForegroundColor Yellow
    $tempPath = "$env:TEMP\sqlite-netstandard20-binary-1.0.118.0.zip"
    Invoke-WebRequest -Uri "https://system.data.sqlite.org/blobs/1.0.118.0/sqlite-netstandard20-binary-1.0.118.0.zip" -OutFile $tempPath
    
    $extractPath = "$env:TEMP\sqlite-extract"
    Expand-Archive -Path $tempPath -DestinationPath $extractPath -Force
    
    $sqliteDll = Get-ChildItem -Path $extractPath -Filter "System.Data.SQLite.dll" -Recurse | Select-Object -First 1
    if ($sqliteDll) {
        $sqliteNugetPath = $sqliteDll.FullName
    }
}

try {
    Add-Type -Path $sqliteNugetPath
    Write-Host "SQLite library loaded" -ForegroundColor Green
} catch {
    Write-Host "Could not load SQLite library. Using alternative method..." -ForegroundColor Yellow
}

Write-Host ""

# Azure SQL connection
$azureConnectionString = "Server=$sqlServer;Database=$sqlDatabase;User ID=$sqlUsername;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"

# Function to read SQLite data using sqlite3.exe (fallback)
function Get-SQLiteDataViaCLI {
    param([string]$Query)
    
    # Try to use sqlite3.exe if available
    $sqlite3Paths = @(
        "C:\Program Files\SQLite\sqlite3.exe",
        "C:\SQLite\sqlite3.exe",
        "$env:LOCALAPPDATA\Programs\SQLite\sqlite3.exe"
    )
    
    $sqlite3 = $sqlite3Paths | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if (-not $sqlite3) {
        Write-Host "  Downloading sqlite3.exe..." -ForegroundColor Yellow
        $sqlite3Dir = "$env:TEMP\sqlite3"
        New-Item -ItemType Directory -Path $sqlite3Dir -Force | Out-Null
        $sqlite3 = "$sqlite3Dir\sqlite3.exe"
        
        Invoke-WebRequest -Uri "https://www.sqlite.org/2024/sqlite-tools-win-x64-3460100.zip" -OutFile "$env:TEMP\sqlite-tools.zip"
        Expand-Archive -Path "$env:TEMP\sqlite-tools.zip" -DestinationPath $sqlite3Dir -Force
        
        $sqlite3 = Get-ChildItem -Path $sqlite3Dir -Filter "sqlite3.exe" -Recurse | Select-Object -First 1 | ForEach-Object { $_.FullName }
    }
    
    # Execute query and return CSV
    $output = & $sqlite3 $sqliteDbPath -csv -header $Query
    return $output | ConvertFrom-Csv
}

Write-Host "=== Starting Migration ===" -ForegroundColor Cyan
Write-Host ""

try {
    # 1. Migrate People
    Write-Host "Step 1: Migrating People..." -ForegroundColor Yellow
    $people = Get-SQLiteDataViaCLI -Query "SELECT * FROM NameEvent ORDER BY NameID"
    
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
"@
        Invoke-Sqlcmd -ConnectionString $azureConnectionString -Query $query `
            -Variable "NameID=$($person.NameID)", "NameLName=$($person.NameLName)", "neCount=$($person.neCount)"
        
        $peopleCount++
        if ($peopleCount % 10 -eq 0) {
            Write-Host "  $peopleCount people..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $peopleCount people" -ForegroundColor Green
    Write-Host ""

    # 2. Migrate Pictures
    Write-Host "Step 2: Migrating Pictures..." -ForegroundColor Yellow
    $pictures = Get-SQLiteDataViaCLI -Query "SELECT * FROM Pictures ORDER BY PFileName LIMIT 1000"
    
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
"@
        $eventDate = if ($pic.PEventDate) { $pic.PEventDate } else { [DBNull]::Value }
        
        Invoke-Sqlcmd -ConnectionString $azureConnectionString -Query $query `
            -Variable "PFileName=$($pic.PFileName)", "PDirectory=$($pic.PDirectory)", `
            "PThumbUrl=$($pic.PThumbUrl)", "PType=$($pic.PType)", `
            "PWidth=$($pic.PWidth)", "PHeight=$($pic.PHeight)", `
            "PVtime=$($pic.PVtime)", "PEventDate=$eventDate", `
            "PBlobUrl=$($pic.PBlobUrl)"
        
        $picturesCount++
        if ($picturesCount % 50 -eq 0) {
            Write-Host "  $picturesCount pictures..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $picturesCount pictures (first 1000)" -ForegroundColor Green
    Write-Host ""

    # 3. Migrate Tags
    Write-Host "Step 3: Migrating Photo Tags..." -ForegroundColor Yellow
    $tags = Get-SQLiteDataViaCLI -Query "SELECT * FROM NamePhoto"
    
    $tagsCount = 0
    foreach ($tag in $tags) {
        $query = @"
IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE PFileName = @PFileName AND NameID = @NameID)
BEGIN
    INSERT INTO dbo.NamePhoto (PFileName, NameID, npXPos, npYPos)
    VALUES (@PFileName, @NameID, @npXPos, @npYPos);
END
"@
        Invoke-Sqlcmd -ConnectionString $azureConnectionString -Query $query `
            -Variable "PFileName=$($tag.PFileName)", "NameID=$($tag.NameID)", `
            "npXPos=$($tag.npXPos)", "npYPos=$($tag.npYPos)"
        
        $tagsCount++
        if ($tagsCount % 100 -eq 0) {
            Write-Host "  $tagsCount tags..." -ForegroundColor Gray
        }
    }
    Write-Host "  Migrated $tagsCount tags" -ForegroundColor Green
    Write-Host ""

    # Summary
    Write-Host "=== Migration Complete ===" -ForegroundColor Cyan
    Write-Host "People:   $peopleCount" -ForegroundColor White
    Write-Host "Pictures: $picturesCount" -ForegroundColor White
    Write-Host "Tags:     $tagsCount" -ForegroundColor White
    Write-Host ""
    Write-Host "Success! Visit https://lively-glacier-02a77180f.2.azurestaticapps.net/" -ForegroundColor Green

} catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor Red
    exit 1
}
