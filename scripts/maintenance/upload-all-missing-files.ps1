# Upload missing files from E:\Family Album to Azure Blob Storage
# This script uploads files that exist locally but not in blob storage

param(
    [switch]$DryRun,
    [switch]$MediaOnly
)

$storageAccount = "famprodgajerhxssqswm"
$containerName = "family-album-media"
$storageKey = $env:AZURE_STORAGE_KEY
$localBasePath = "E:\Family Album"

if (-not $storageKey) {
    Write-Host "❌ AZURE_STORAGE_KEY environment variable not set" -ForegroundColor Red
    exit 1
}

Write-Host "=" * 80
Write-Host "Upload Missing Media Files"
Write-Host "=" * 80
Write-Host "Source: $localBasePath"
Write-Host "Target: $storageAccount/$containerName"
Write-Host "=" * 80
Write-Host ""

if ($DryRun) {
    Write-Host "🔍 DRY-RUN MODE - No files will be uploaded" -ForegroundColor Yellow
    Write-Host ""
}

# Get all files in blob storage
Write-Host "📥 Getting list of files in blob storage..."
$blobList = az storage blob list `
    --account-name $storageAccount `
    --account-key $storageKey `
    --container-name $containerName `
    --query "[].name" `
    --output json | ConvertFrom-Json

$blobSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
foreach ($blob in $blobList) {
    [void]$blobSet.Add($blob)
}

Write-Host "   Found $($blobSet.Count) files in blob storage"
Write-Host ""

# Get all local files
Write-Host "📁 Scanning local files..."
$localFiles = Get-ChildItem -Path $localBasePath -File -Recurse

# Filter to media files only if requested
if ($MediaOnly) {
    $mediaExtensions = @('.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', 
                         '.mp4', '.mov', '.avi', '.mpg', '.mpeg', '.wmv', '.m4v', '.3gp')
    $localFiles = $localFiles | Where-Object { $mediaExtensions -contains $_.Extension.ToLower() }
    Write-Host "   Found $($localFiles.Count) media files (filtered)" -ForegroundColor Cyan
} else {
    Write-Host "   Found $($localFiles.Count) local files"
}
Write-Host ""

# Find missing files
Write-Host "🔍 Checking for missing files..."
$missingFiles = @()

foreach ($file in $localFiles) {
    $relativePath = $file.FullName.Substring($localBasePath.Length + 1).Replace('\', '/')
    
    if (-not $blobSet.Contains($relativePath)) {
        $missingFiles += @{
            LocalPath = $file.FullName
            BlobPath = $relativePath
            Size = $file.Length
        }
    }
}

Write-Host "   Found $($missingFiles.Count) missing files"
Write-Host ""

if ($missingFiles.Count -eq 0) {
    Write-Host "✅ No missing files found!" -ForegroundColor Green
    exit 0
}

# Show summary by folder
$byFolder = $missingFiles | Group-Object { Split-Path $_.BlobPath -Parent } | Sort-Object Count -Descending

Write-Host "Missing files by folder:"
foreach ($folder in $byFolder) {
    $totalSize = ($folder.Group | Measure-Object -Property Size -Sum).Sum / 1MB
    Write-Host "  📁 $($folder.Name): $($folder.Count) files ($("{0:N2}" -f $totalSize) MB)"
}
Write-Host ""

if ($DryRun) {
    Write-Host "Dry-run complete. To upload, run without -DryRun flag." -ForegroundColor Yellow
    exit 0
}

# Upload missing files
$totalSize = ($missingFiles | Measure-Object -Property Size -Sum).Sum
Write-Host "📤 Uploading $($missingFiles.Count) files ($("{0:N2}" -f ($totalSize / 1MB)) MB)..."
Write-Host ""

$uploaded = 0
$failed = 0
$startTime = Get-Date

foreach ($file in $missingFiles) {
    $uploaded++
    $percent = [math]::Round(($uploaded / $missingFiles.Count) * 100, 1)
    
    Write-Host "[$uploaded/$($missingFiles.Count) - $percent%] Uploading: $($file.BlobPath)" -NoNewline
    
    try {
        # Use array to avoid special character issues with &
        $azArgs = @(
            'storage', 'blob', 'upload',
            '--account-name', $storageAccount,
            '--account-key', $storageKey,
            '--container-name', $containerName,
            '--name', $file.BlobPath,
            '--file', $file.LocalPath,
            '--no-progress',
            '--only-show-errors',
            '--output', 'none'
        )
        
        $result = & az @azArgs 2>&1
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host " ❌" -ForegroundColor Red
            Write-Host "   Error: $result" -ForegroundColor Red
            $failed++
        }
    }
    catch {
        Write-Host " ❌" -ForegroundColor Red
        Write-Host "   Error: $_" -ForegroundColor Red
        $failed++
    }
}

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalMinutes

Write-Host ""
Write-Host "=" * 80
Write-Host "UPLOAD SUMMARY"
Write-Host "=" * 80
Write-Host "Total files:    $($missingFiles.Count)"
Write-Host "Uploaded:       $($uploaded - $failed)"
Write-Host "Failed:         $failed"
Write-Host "Total size:     $("{0:N2}" -f ($totalSize / 1MB)) MB"
Write-Host "Time elapsed:   $("{0:N1}" -f $duration) minutes"
Write-Host "Average speed:  $("{0:N2}" -f (($totalSize / 1MB) / $duration)) MB/min"
Write-Host "=" * 80

if ($failed -eq 0) {
    Write-Host ""
    Write-Host "✅ Upload complete!" -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "⚠️  Upload completed with $failed errors" -ForegroundColor Yellow
}
