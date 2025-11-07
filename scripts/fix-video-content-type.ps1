# Fix Content-Type for converted MP4 files that still have video/avi metadata

$storageAccount = "familyalbummedia"
$container = "family-album-media"
$filename = "MVI_0996.mp4"

Write-Host "Updating Content-Type for $filename to video/mp4..." -ForegroundColor Cyan

az storage blob update `
    --account-name $storageAccount `
    --container-name $container `
    --name $filename `
    --content-type "video/mp4"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Content-Type updated successfully!" -ForegroundColor Green
    
    # Verify the change
    Write-Host "`nVerifying..." -ForegroundColor Cyan
    $contentType = az storage blob show `
        --account-name $storageAccount `
        --container-name $container `
        --name $filename `
        --query "properties.contentSettings.contentType" `
        --output tsv
    
    Write-Host "Current Content-Type: $contentType" -ForegroundColor Yellow
} else {
    Write-Host "Failed to update Content-Type" -ForegroundColor Red
}
