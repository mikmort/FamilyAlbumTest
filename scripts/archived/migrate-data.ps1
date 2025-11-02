# Data Migration Script for Family Album
# This script migrates data from OneDrive backup to Azure SQL Database

Write-Host "=== Family Album Data Migration ===" -ForegroundColor Cyan
Write-Host ""

# Load deployment info
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

Write-Host "SQL Server: $sqlServer" -ForegroundColor White
Write-Host "Database: $sqlDatabase" -ForegroundColor White
Write-Host ""

# Install SqlServer module if not present
if (-not (Get-Module -ListAvailable -Name SqlServer)) {
    Write-Host "Installing SqlServer PowerShell module..." -ForegroundColor Yellow
    Install-Module -Name SqlServer -Force -AllowClobber -Scope CurrentUser
}

Import-Module SqlServer

Write-Host "=== Data Migration Options ===" -ForegroundColor Cyan
Write-Host "1. Migrate from CSV files (Pictures.csv, NameEvent.csv, NamePhoto.csv)" -ForegroundColor White
Write-Host "2. Migrate from SQL backup (.bak file)" -ForegroundColor White
Write-Host "3. Migrate from SQL script (.sql file)" -ForegroundColor White
Write-Host "4. Migrate media files to Azure Blob Storage" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Select migration option (1-4)"

# Construct connection string
$connectionString = "Server=$sqlServer;Database=$sqlDatabase;User ID=$sqlUsername;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"

switch ($choice) {
    "1" {
        Write-Host ""
        Write-Host "=== CSV Migration ===" -ForegroundColor Cyan
        $dataPath = Read-Host "Enter path to folder containing CSV files"
        
        if (-not (Test-Path $dataPath)) {
            Write-Host "Error: Path not found" -ForegroundColor Red
            exit 1
        }

        # Import NameEvent (people)
        $nameEventFile = Join-Path $dataPath "NameEvent.csv"
        if (Test-Path $nameEventFile) {
            Write-Host "Importing people from NameEvent.csv..." -ForegroundColor Yellow
            $nameEvents = Import-Csv $nameEventFile
            
            foreach ($person in $nameEvents) {
                $query = @"
                IF NOT EXISTS (SELECT 1 FROM dbo.NameEvent WHERE NameID = @NameID)
                BEGIN
                    SET IDENTITY_INSERT dbo.NameEvent ON
                    INSERT INTO dbo.NameEvent (NameID, NameLName, neCount)
                    VALUES (@NameID, @NameLName, @neCount)
                    SET IDENTITY_INSERT dbo.NameEvent OFF
                END
"@
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $query `
                    -Variable "NameID=$($person.NameID)", "NameLName=$($person.NameLName)", "neCount=$($person.neCount)"
            }
            Write-Host "  Imported $($nameEvents.Count) people" -ForegroundColor Green
        }

        # Import Pictures
        $picturesFile = Join-Path $dataPath "Pictures.csv"
        if (Test-Path $picturesFile) {
            Write-Host "Importing pictures from Pictures.csv..." -ForegroundColor Yellow
            $pictures = Import-Csv $picturesFile
            
            foreach ($pic in $pictures) {
                $query = @"
                IF NOT EXISTS (SELECT 1 FROM dbo.Pictures WHERE PFileName = @PFileName)
                BEGIN
                    INSERT INTO dbo.Pictures 
                    (PFileName, PDirectory, PThumbUrl, PType, PWidth, PHeight, PVtime, PEventDate, PBlobUrl)
                    VALUES 
                    (@PFileName, @PDirectory, @PThumbUrl, @PType, @PWidth, @PHeight, @PVtime, @PEventDate, @PBlobUrl)
                END
"@
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $query `
                    -Variable "PFileName=$($pic.PFileName)", "PDirectory=$($pic.PDirectory)", `
                    "PThumbUrl=$($pic.PThumbUrl)", "PType=$($pic.PType)", `
                    "PWidth=$($pic.PWidth)", "PHeight=$($pic.PHeight)", `
                    "PVtime=$($pic.PVtime)", "PEventDate=$($pic.PEventDate)", `
                    "PBlobUrl=$($pic.PBlobUrl)"
            }
            Write-Host "  Imported $($pictures.Count) pictures" -ForegroundColor Green
        }

        # Import NamePhoto (tags)
        $namePhotoFile = Join-Path $dataPath "NamePhoto.csv"
        if (Test-Path $namePhotoFile) {
            Write-Host "Importing photo tags from NamePhoto.csv..." -ForegroundColor Yellow
            $namePhotos = Import-Csv $namePhotoFile
            
            foreach ($tag in $namePhotos) {
                $query = @"
                IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE PFileName = @PFileName AND NameID = @NameID)
                BEGIN
                    INSERT INTO dbo.NamePhoto (PFileName, NameID, npXPos, npYPos)
                    VALUES (@PFileName, @NameID, @npXPos, @npYPos)
                END
"@
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $query `
                    -Variable "PFileName=$($tag.PFileName)", "NameID=$($tag.NameID)", `
                    "npXPos=$($tag.npXPos)", "npYPos=$($tag.npYPos)"
            }
            Write-Host "  Imported $($namePhotos.Count) photo tags" -ForegroundColor Green
        }

        Write-Host ""
        Write-Host "CSV migration completed!" -ForegroundColor Green
    }

    "2" {
        Write-Host ""
        Write-Host "=== SQL Backup Restore ===" -ForegroundColor Cyan
        Write-Host "Note: Azure SQL Database does not support .bak restores directly." -ForegroundColor Yellow
        Write-Host "You need to:" -ForegroundColor White
        Write-Host "1. Restore .bak to local SQL Server" -ForegroundColor White
        Write-Host "2. Use SQL Server Management Studio's 'Deploy Database to Azure SQL Database' wizard" -ForegroundColor White
        Write-Host "3. Or export to BACPAC and import to Azure" -ForegroundColor White
    }

    "3" {
        Write-Host ""
        Write-Host "=== SQL Script Migration ===" -ForegroundColor Cyan
        $sqlFile = Read-Host "Enter path to SQL script file"
        
        if (-not (Test-Path $sqlFile)) {
            Write-Host "Error: File not found" -ForegroundColor Red
            exit 1
        }

        Write-Host "Executing SQL script..." -ForegroundColor Yellow
        Invoke-Sqlcmd -ConnectionString $connectionString -InputFile $sqlFile -Verbose
        Write-Host "SQL script executed!" -ForegroundColor Green
    }

    "4" {
        Write-Host ""
        Write-Host "=== Media Files Migration ===" -ForegroundColor Cyan
        $mediaPath = Read-Host "Enter path to folder containing media files"
        
        if (-not (Test-Path $mediaPath)) {
            Write-Host "Error: Path not found" -ForegroundColor Red
            exit 1
        }

        # Load storage configuration
        if (-not (Test-Path ".env.local")) {
            Write-Host "Error: .env.local not found" -ForegroundColor Red
            exit 1
        }

        $envContent = Get-Content ".env.local" -Raw
        $storageAccount = ""
        $storageKey = ""

        if ($envContent -match 'AZURE_STORAGE_ACCOUNT=(.+)') {
            $storageAccount = $Matches[1].Trim()
        }
        if ($envContent -match 'AZURE_STORAGE_KEY=(.+)') {
            $storageKey = $Matches[1].Trim()
        }

        Write-Host "Installing Azure Storage module..." -ForegroundColor Yellow
        if (-not (Get-Module -ListAvailable -Name Az.Storage)) {
            Install-Module -Name Az.Storage -Force -AllowClobber -Scope CurrentUser
        }

        Import-Module Az.Storage

        # Create storage context
        $ctx = New-AzStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey

        Write-Host "Uploading media files..." -ForegroundColor Yellow
        $files = Get-ChildItem -Path $mediaPath -File -Recurse
        $uploaded = 0

        foreach ($file in $files) {
            $relativePath = $file.FullName.Substring($mediaPath.Length).TrimStart('\', '/')
            $blobName = "media/$relativePath"
            
            try {
                Set-AzStorageBlobContent -File $file.FullName -Container "family-album-media" `
                    -Blob $blobName -Context $ctx -Force | Out-Null
                $uploaded++
                Write-Host "  Uploaded: $relativePath" -ForegroundColor Gray
            } catch {
                Write-Host "  Failed: $relativePath - $($_.Exception.Message)" -ForegroundColor Red
            }
        }

        Write-Host ""
        Write-Host "Uploaded $uploaded of $($files.Count) files" -ForegroundColor Green
    }

    default {
        Write-Host "Invalid option" -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "=== Migration Complete ===" -ForegroundColor Cyan
