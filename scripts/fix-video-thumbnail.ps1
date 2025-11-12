# Force regenerate thumbnail for a specific video
# This will delete the old thumbnail and create a new one

$filename = "Miscellaneous Pictures/71841758817__B521553C-531A-4209-A721-49A39092DEE7.mp4"

Write-Host "Force regenerating thumbnail for: $filename" -ForegroundColor Cyan

# Construct the expected thumbnail path
$filenameParts = $filename -split '/'
$path = ($filenameParts[0..($filenameParts.Length-2)]) -join '/'
$file = $filenameParts[-1]
$filenameWithoutExt = [System.IO.Path]::GetFileNameWithoutExtension($file)
$thumbPath = "media/thumb_$filenameWithoutExt.jpg"

Write-Host "Expected thumbnail path: $thumbPath" -ForegroundColor Yellow

# Load Azure credentials
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$storageAccount = $env:AZURE_STORAGE_ACCOUNT
$storageKey = $env:AZURE_STORAGE_KEY
$containerName = $env:AZURE_STORAGE_CONTAINER

if (-not $storageAccount -or -not $storageKey) {
    Write-Host "❌ Azure credentials not found in .env.local" -ForegroundColor Red
    exit 1
}

Write-Host "`nDeleting old thumbnail from blob storage..." -ForegroundColor Yellow

# Delete the thumbnail using Azure CLI or REST API
try {
    $ctx = New-AzStorageContext -StorageAccountName $storageAccount -StorageAccountKey $storageKey
    Remove-AzStorageBlob -Container $containerName -Blob $thumbPath -Context $ctx -Force -ErrorAction Stop
    Write-Host "✅ Old thumbnail deleted" -ForegroundColor Green
}
catch {
    Write-Host "⚠️ Could not delete old thumbnail (might not exist): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host "`nRequesting new thumbnail generation..." -ForegroundColor Yellow

# URL encode the filename
$encodedFilename = [uri]::EscapeDataString($filename)

# Request thumbnail with regenerate flag
$url = "https://family-album.azurewebsites.net/api/media/$encodedFilename`?thumbnail=true&regenerate=true"

Write-Host "Calling: $url" -ForegroundColor Cyan

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
    Write-Host "✅ Thumbnail regenerated successfully!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error regenerating thumbnail" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
