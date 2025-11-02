# Check blob storage for Devorah's Wedding files
$accountName = "famprodgajerhxssqswm"
$containerName = "family-album-media"

Write-Host "Checking blob storage for Devorah's Wedding files..." -ForegroundColor Cyan

# Get blobs with the prefix
$azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"
$blobs = & $azPath storage blob list `
    --account-name $accountName `
    --container-name $containerName `
    --prefix "Devorah's Wedding/" `
    --query "[].name" `
    --output json | ConvertFrom-Json

Write-Host "`nTotal blobs found: $($blobs.Count)" -ForegroundColor Green

Write-Host "`nGrouping by naming pattern:" -ForegroundColor Yellow

$urlEncoded = $blobs | Where-Object { $_ -match "%[0-9A-F]{2}" }
$plain = $blobs | Where-Object { $_ -notmatch "%[0-9A-F]{2}" }

Write-Host "`nURL-Encoded filenames ($($urlEncoded.Count)):" -ForegroundColor Magenta
$urlEncoded | ForEach-Object { Write-Host "  $_" }

Write-Host "`nPlain filenames ($($plain.Count)):" -ForegroundColor Cyan
$plain | ForEach-Object { Write-Host "  $_" }

Write-Host "`n" -NoNewline
Write-Host "Analysis:" -ForegroundColor Yellow
Write-Host "- Directory in blob storage: " -NoNewline
Write-Host "Devorah's Wedding/" -ForegroundColor Green -NoNewline
Write-Host " (with actual apostrophe)"
Write-Host "- Some files have URL-encoded names in blob storage"
Write-Host "- Some files have plain names in blob storage"
Write-Host "`nThis mismatch is causing 500 errors when the API tries to find files."
