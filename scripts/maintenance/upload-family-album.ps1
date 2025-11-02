# Upload all files from D:\Family Album to Azure Blob Storage
# This script matches files on disk with database records and uploads them

param(
    [string]$LocalPath = "D:\Family Album",
    [string]$StorageAccount = "famprodgajerhxssqswm",
    [string]$ContainerName = "family-album-media",
    [switch]$DryRun = $false,
    [switch]$Force = $false,
    [int]$StartIndex = 1
)

# Storage key (get from environment or parameter)
$StorageKey = $env:AZURE_STORAGE_KEY
if (-not $StorageKey) {
    Write-Error "Please set AZURE_STORAGE_KEY environment variable"
    exit 1
}

# SQL Connection
$SqlConnectionString = $env:SQL_CONNECTION_STRING
if (-not $SqlConnectionString) {
    Write-Error "Please set SQL_CONNECTION_STRING environment variable"
    exit 1
}

# Azure CLI path
$AzCmd = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Host "=== Family Album Upload Script ===" -ForegroundColor Cyan
Write-Host "Local Path: $LocalPath"
Write-Host "Storage Account: $StorageAccount"
Write-Host "Container: $ContainerName"
Write-Host "Dry Run: $DryRun"
Write-Host ""

# Test if local path exists
if (-not (Test-Path $LocalPath)) {
    Write-Error "Local path does not exist: $LocalPath"
    exit 1
}

# Get all files from database
Write-Host "Fetching file list from database..." -ForegroundColor Yellow
$node = "C:\Program Files\nodejs\node.exe"
$dbQuery = @"
const sql = require('mssql');
(async () => {
    try {
        await sql.connect(process.env.SQL_CONNECTION_STRING);
        const result = await sql.query``
            SELECT PFileName, PFileDirectory, PType 
            FROM Pictures 
            ORDER BY PFileDirectory, PFileName
        ``;
        console.log(JSON.stringify(result.recordset));
        await sql.close();
    } catch(err) {
        console.error('ERROR:', err.message);
        process.exit(1);
    }
})();
"@

$dbFiles = & $node -e $dbQuery | ConvertFrom-Json

Write-Host "Found $($dbFiles.Count) files in database" -ForegroundColor Green
Write-Host ""

# Statistics
$stats = @{
    Total = 0
    Uploaded = 0
    Skipped = 0
    Missing = 0
    Errors = 0
}

# Process each file
foreach ($dbFile in $dbFiles) {
    $stats.Total++
    
    # Skip files before StartIndex
    if ($stats.Total -lt $StartIndex) {
        continue
    }
    
    # Convert database path (backslashes) to local path
    $relativePath = $dbFile.PFileName
    $localFilePath = Join-Path $LocalPath $relativePath
    
    # Also try with forward slashes in case file system differs
    if (-not (Test-Path $localFilePath)) {
        $alternativePath = $relativePath.Replace('\', '/')
        $localFilePath = Join-Path $LocalPath $alternativePath
    }
    
    # Check if file exists locally
    if (-not (Test-Path $localFilePath)) {
        Write-Host "  [MISSING] $relativePath" -ForegroundColor Red
        $stats.Missing++
        continue
    }
    
    # Get file info
    $fileInfo = Get-Item $localFilePath
    $fileSizeMB = [math]::Round($fileInfo.Length / 1MB, 2)
    
    # Convert to blob path (forward slashes)
    $blobPath = $relativePath.Replace('\', '/')
    
    Write-Host "Processing [$($stats.Total)/$($dbFiles.Count)]: $blobPath ($fileSizeMB MB)" -ForegroundColor Cyan
    
    if ($DryRun) {
        Write-Host "  [DRY-RUN] Would upload: $localFilePath -> $blobPath" -ForegroundColor Yellow
        $stats.Uploaded++
        continue
    }
    
    # Check if blob already exists (unless Force is specified)
    if (-not $Force) {
        $blobExists = $false
        try {
            $checkResult = & $AzCmd storage blob exists `
                --account-name $StorageAccount `
                --account-key $StorageKey `
                --container-name $ContainerName `
                --name $blobPath `
                --output json 2>$null | ConvertFrom-Json
            
            $blobExists = $checkResult.exists
        } catch {
            # Assume doesn't exist if check fails
            $blobExists = $false
        }
        
        if ($blobExists) {
            Write-Host "  [SKIPPED] Already exists in blob storage" -ForegroundColor Gray
            $stats.Skipped++
            continue
        }
    }
    
    # Upload the file
    try {
        Write-Host "  [UPLOADING] $fileSizeMB MB..." -ForegroundColor Yellow -NoNewline
        
        $uploadResult = & $AzCmd storage blob upload `
            --account-name $StorageAccount `
            --account-key $StorageKey `
            --container-name $ContainerName `
            --name $blobPath `
            --file $localFilePath `
            --overwrite `
            --output none 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " SUCCESS" -ForegroundColor Green
            $stats.Uploaded++
        } else {
            Write-Host " FAILED" -ForegroundColor Red
            Write-Host "  Error: $uploadResult" -ForegroundColor Red
            $stats.Errors++
        }
    } catch {
        Write-Host " ERROR" -ForegroundColor Red
        Write-Host "  Exception: $($_.Exception.Message)" -ForegroundColor Red
        $stats.Errors++
    }
    
    # Small delay to avoid rate limiting
    Start-Sleep -Milliseconds 100
}

# Summary
Write-Host ""
Write-Host "=== Upload Summary ===" -ForegroundColor Cyan
Write-Host "Total files in database: $($stats.Total)"
Write-Host "Successfully uploaded:   $($stats.Uploaded)" -ForegroundColor Green
Write-Host "Skipped (already exist): $($stats.Skipped)" -ForegroundColor Gray
Write-Host "Missing locally:         $($stats.Missing)" -ForegroundColor Red
Write-Host "Errors:                  $($stats.Errors)" -ForegroundColor Red
Write-Host ""

if ($DryRun) {
    Write-Host "This was a DRY RUN. Re-run without -DryRun to actually upload files." -ForegroundColor Yellow
}
