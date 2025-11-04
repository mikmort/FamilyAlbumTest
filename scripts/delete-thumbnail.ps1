# Script to delete a specific thumbnail from Azure Blob Storage
# This forces the thumbnail to be regenerated on next request

param(
    [Parameter(Mandatory=$true)]
    [string]$FileName
)

# Load environment variables
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]*?)\s*=\s*(.*?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            [Environment]::SetEnvironmentVariable($name, $value, "Process")
        }
    }
}

$storageAccountName = $env:AZURE_STORAGE_ACCOUNT_NAME
if (-not $storageAccountName) {
    $storageAccountName = $env:AZURE_STORAGE_ACCOUNT
}

$storageAccountKey = $env:AZURE_STORAGE_ACCOUNT_KEY
if (-not $storageAccountKey) {
    $storageAccountKey = $env:AZURE_STORAGE_KEY
}

$containerName = $env:AZURE_STORAGE_CONTAINER
if (-not $containerName) {
    $containerName = "family-album-media"
}

if (-not $storageAccountName -or -not $storageAccountKey) {
    Write-Host "ERROR: Storage account credentials not found in .env.local" -ForegroundColor Red
    exit 1
}

# Construct thumbnail path
# If filename doesn't start with "media/", add it
$blobPath = if ($FileName.StartsWith("media/")) { $FileName } else { "media/$FileName" }
$thumbnailPath = "thumbnails/$blobPath"

Write-Host "Thumbnail path: $thumbnailPath" -ForegroundColor Cyan

# Import Azure Storage module
try {
    Import-Module Az.Storage -ErrorAction Stop
} catch {
    Write-Host "Installing Az.Storage module..." -ForegroundColor Yellow
    Install-Module -Name Az.Storage -Force -AllowClobber -Scope CurrentUser
    Import-Module Az.Storage
}

# Create storage context
$context = New-AzStorageContext -StorageAccountName $storageAccountName -StorageAccountKey $storageAccountKey

# Check if thumbnail exists
try {
    $blob = Get-AzStorageBlob -Container $containerName -Blob $thumbnailPath -Context $context -ErrorAction Stop
    Write-Host "✓ Thumbnail found: $thumbnailPath" -ForegroundColor Green
    Write-Host "  Size: $($blob.Length) bytes" -ForegroundColor Gray
    Write-Host "  Last Modified: $($blob.LastModified)" -ForegroundColor Gray
    
    # Delete thumbnail
    Write-Host "`nDeleting thumbnail..." -ForegroundColor Yellow
    Remove-AzStorageBlob -Container $containerName -Blob $thumbnailPath -Context $context -Force
    Write-Host "✓ Thumbnail deleted successfully!" -ForegroundColor Green
    Write-Host "`nThe thumbnail will be regenerated with correct orientation on next view." -ForegroundColor Cyan
    
} catch {
    Write-Host "✗ Thumbnail not found: $thumbnailPath" -ForegroundColor Red
    Write-Host "  It may have already been deleted or never existed." -ForegroundColor Gray
}

Write-Host "`nDone!" -ForegroundColor Cyan
