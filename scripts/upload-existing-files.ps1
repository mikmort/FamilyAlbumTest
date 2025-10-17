# Upload media files to Azure Blob Storage based on existing database paths
# This script reads the database to get the correct paths and uploads files to match

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceDirectory = "E:\Family Album",
    
    [Parameter(Mandatory=$false)]
    [int]$BatchSize = 10,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

Write-Host "=== Upload Files to Match Database Paths ===" -ForegroundColor Cyan
Write-Host "This script uploads files to blob storage using the paths from the database"  -ForegroundColor Yellow
Write-Host ""

# Load environment from api/local.settings.json
$localSettingsPath = "api/local.settings.json"
if (Test-Path $localSettingsPath) {
    Write-Host "Loading Azure Storage credentials..." -ForegroundColor Yellow
    $settings = Get-Content $localSettingsPath | ConvertFrom-Json
    $env:AZURE_STORAGE_ACCOUNT = $settings.Values.AZURE_STORAGE_ACCOUNT
    $env:AZURE_STORAGE_KEY = $settings.Values.AZURE_STORAGE_KEY
    $env:AZURE_STORAGE_CONTAINER = $settings.Values.AZURE_STORAGE_CONTAINER
}

if (-not $env:AZURE_STORAGE_ACCOUNT -or -not $env:AZURE_STORAGE_KEY) {
    Write-Host "ERROR: Missing Azure Storage credentials" -ForegroundColor Red
    exit 1
}

# Load Az.Storage module
try {
    Import-Module Az.Storage -ErrorAction Stop
} catch {
    Write-Host "ERROR: Az.Storage module not found. Installing..." -ForegroundColor Yellow
    Install-Module -Name Az.Storage -Scope CurrentUser -Force
    Import-Module Az.Storage
}

# Create storage context
Write-Host "Connecting to Azure Storage..." -ForegroundColor Yellow
$ctx = New-AzStorageContext -StorageAccountName $env:AZURE_STORAGE_ACCOUNT -StorageAccountKey $env:AZURE_STORAGE_KEY

# Fetch media list from database (via API)
Write-Host "Fetching media list from database..." -ForegroundColor Yellow
$apiUrl = "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media"
$mediaItems = Invoke-RestMethod -Uri $apiUrl -Method Get

Write-Host "Found $($mediaItems.Count) items in database" -ForegroundColor Green
Write-Host ""

$uploadCount = 0
$skipCount = 0
$errorCount = 0
$notFoundCount = 0

foreach ($item in $mediaItems) {
    $directory = $item.PFileDirectory
    $filename = $item.PFileName
    
    # Construct expected blob path (same logic as API)
    if ($directory -and $filename.StartsWith($directory)) {
        $blobPath = $filename
    } elseif ($directory) {
        $blobPath = "$directory\$filename"
    } else {
        $blobPath = $filename
    }
    
    # Normalize for blob storage (forward slashes)
    $blobPathNormalized = $blobPath.Replace('\', '/')
    
    # Find the file on disk
    $localPath = Join-Path $SourceDirectory $blobPath
    
    if (-not (Test-Path $localPath)) {
        Write-Host "✗ NOT FOUND ON DISK: $blobPath" -ForegroundColor Red
        Write-Host "  Looked in: $localPath" -ForegroundColor Gray
        $notFoundCount++
        continue
    }
    
    if ($WhatIf) {
        Write-Host "[WHATIF] Would upload: $localPath -> $blobPathNormalized" -ForegroundColor Cyan
        continue
    }
    
    # Check if blob already exists
    try {
        $existingBlob = Get-AzStorageBlob -Container $env:AZURE_STORAGE_CONTAINER -Blob $blobPathNormalized -Context $ctx -ErrorAction Stop
        Write-Host "⊙ SKIP (already exists): $blobPathNormalized" -ForegroundColor Yellow
        $skipCount++
        continue
    } catch {
        # Blob doesn't exist, we'll upload it
    }
    
    # Upload the file
    try {
        Write-Host "↑ UPLOADING: $blobPathNormalized" -ForegroundColor Green
        Set-AzStorageBlobContent `
            -File $localPath `
            -Container $env:AZURE_STORAGE_CONTAINER `
            -Blob $blobPathNormalized `
            -Context $ctx `
            -Force `
            -ErrorAction Stop | Out-Null
        
        $uploadCount++
        
        # Show progress every 10 files
        if ($uploadCount % 10 -eq 0) {
            Write-Host "  Progress: $uploadCount uploaded, $skipCount skipped, $notFoundCount not found" -ForegroundColor Cyan
        }
    } catch {
        Write-Host "✗ ERROR uploading $blobPathNormalized : $($_.Exception.Message)" -ForegroundColor Red
        $errorCount++
    }
}

Write-Host ""
Write-Host "=== Upload Complete ===" -ForegroundColor Cyan
Write-Host "Uploaded: $uploadCount" -ForegroundColor Green
Write-Host "Skipped (already exist): $skipCount" -ForegroundColor Yellow
Write-Host "Not found on disk: $notFoundCount" -ForegroundColor Red
Write-Host "Errors: $errorCount" -ForegroundColor Red
