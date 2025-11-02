param(
    [string]$LocalPath = "E:\Family Album",
    [string]$StorageAccount = "famprodgajerhxssqswm",
    [string]$Container = "family-album-media",
    [switch]$DryRun = $false
)

# Check prerequisites
if (-not $env:AZURE_STORAGE_KEY) {
    Write-Host "❌ AZURE_STORAGE_KEY environment variable not set" -ForegroundColor Red
    Write-Host "Run: `$env:AZURE_STORAGE_KEY = 'your-key'" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $LocalPath)) {
    Write-Host "❌ Local path not found: $LocalPath" -ForegroundColor Red
    exit 1
}

Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Upload Missing MOV Files" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Local Path:      $LocalPath"
Write-Host "Storage Account: $StorageAccount"
Write-Host "Container:       $Container"
Write-Host "Dry Run:         $DryRun"
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Get all local MOV files
Write-Host "🔍 Scanning local MOV files..." -ForegroundColor Yellow
$localMovFiles = Get-ChildItem -Path $LocalPath -Filter "*.MOV" -File -Recurse -ErrorAction SilentlyContinue

Write-Host "   Found $($localMovFiles.Count) MOV files locally" -ForegroundColor Green
Write-Host ""

# Get existing blobs from storage
Write-Host "🔍 Fetching existing blobs from storage..." -ForegroundColor Yellow
$existingBlobs = @{}

$blobList = az storage blob list `
    --account-name $StorageAccount `
    --account-key $env:AZURE_STORAGE_KEY `
    --container-name $Container `
    --output json | ConvertFrom-Json

foreach ($blob in $blobList) {
    $existingBlobs[$blob.name] = $true
}

Write-Host "   Found $($existingBlobs.Count) blobs in storage" -ForegroundColor Green
Write-Host ""

# Find missing files
Write-Host "🔍 Finding missing files..." -ForegroundColor Yellow
$missingFiles = @()

foreach ($file in $localMovFiles) {
    $relativePath = $file.FullName.Substring($LocalPath.Length + 1).Replace('\', '/')
    
    if (-not $existingBlobs.ContainsKey($relativePath)) {
        $missingFiles += @{
            LocalPath = $file.FullName
            BlobPath = $relativePath
            Size = $file.Length
        }
    }
}

Write-Host "   Found $($missingFiles.Count) files missing from blob storage" -ForegroundColor Green
Write-Host ""

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ No missing files to upload!" -ForegroundColor Green
    exit 0
}

# Show files to be uploaded
Write-Host "📋 Files to upload:" -ForegroundColor Cyan
$totalSize = 0
foreach ($file in $missingFiles) {
    $sizeMB = [math]::Round($file.Size / 1MB, 2)
    $totalSize += $file.Size
    Write-Host "   $($file.BlobPath)" -NoNewline
    Write-Host " ($sizeMB MB)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "Total size: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY RUN - No files uploaded" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Run without -DryRun to upload these files" -ForegroundColor Yellow
    exit 0
}

# Upload files
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "UPLOADING FILES" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

$uploaded = 0
$failed = 0
$uploadedSize = 0
$startTime = Get-Date

foreach ($file in $missingFiles) {
    $num = $uploaded + $failed + 1
    $percent = [math]::Round(($num / $missingFiles.Count) * 100, 1)
    
    Write-Host "[$num/$($missingFiles.Count) - $percent%] Uploading: $($file.BlobPath)" -ForegroundColor Yellow
    
    try {
        az storage blob upload `
            --account-name $StorageAccount `
            --account-key $env:AZURE_STORAGE_KEY `
            --container-name $Container `
            --name $file.BlobPath `
            --file $file.LocalPath `
            --overwrite `
            --output none
        
        if ($LASTEXITCODE -eq 0) {
            $uploaded++
            $uploadedSize += $file.Size
            Write-Host "   ✅ Success" -ForegroundColor Green
        } else {
            $failed++
            Write-Host "   ❌ Failed (exit code: $LASTEXITCODE)" -ForegroundColor Red
        }
    } catch {
        $failed++
        Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

$elapsed = (Get-Date) - $startTime
$elapsedMin = [math]::Round($elapsed.TotalMinutes, 1)

Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "UPLOAD SUMMARY" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Total files:     $($missingFiles.Count)"
Write-Host "Uploaded:        $uploaded" -ForegroundColor Green
Write-Host "Failed:          $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
Write-Host "Total size:      $([math]::Round($uploadedSize / 1MB, 2)) MB"
Write-Host "Time elapsed:    $elapsedMin minutes"
if ($uploaded -gt 0) {
    $avgSpeed = [math]::Round(($uploadedSize / 1MB) / $elapsed.TotalSeconds, 2)
    Write-Host "Average speed:   $avgSpeed MB/s"
}
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

if ($uploaded -gt 0) {
    Write-Host "✅ Upload complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "1. Convert MOV to MP4: cd api && node ..\scripts\convert-blob-mov-to-mp4.js" -ForegroundColor Yellow
    Write-Host "2. Update database:    node ..\scripts\update-database-after-conversion.js" -ForegroundColor Yellow
    Write-Host "3. Clean thumbnails:   node ..\scripts\cleanup-placeholder-thumbnails.js" -ForegroundColor Yellow
} else {
    Write-Host "⚠️  No files were uploaded" -ForegroundColor Yellow
}
