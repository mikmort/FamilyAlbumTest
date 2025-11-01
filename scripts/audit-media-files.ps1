param(
    [string]$LocalPath = "E:\Family Album",
    [string]$StorageAccount = "famprodgajerhxssqswm",
    [string]$Container = "family-album-media",
    [switch]$MOVOnly = $false,
    [switch]$UploadMissing = $false,
    [switch]$ConvertMOVtoMP4 = $false
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
Write-Host "Media Files Audit" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "Local Path:      $LocalPath"
Write-Host "Storage Account: $StorageAccount"
Write-Host "Container:       $Container"
Write-Host "Filter:          $(if ($MOVOnly) { '*.MOV files only' } else { 'All files' })"
Write-Host "Upload Missing:  $UploadMissing"
Write-Host "Convert to MP4:  $ConvertMOVtoMP4"
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""

# Step 1: Get all files from blob storage
Write-Host "🔍 Step 1: Fetching files from blob storage..." -ForegroundColor Yellow
$blobFiles = @{}
$nextMarker = $null

do {
    $listArgs = @(
        "storage", "blob", "list",
        "--account-name", $StorageAccount,
        "--account-key", $env:AZURE_STORAGE_KEY,
        "--container-name", $Container,
        "--output", "json"
    )
    
    if ($nextMarker) {
        $listArgs += "--marker"
        $listArgs += $nextMarker
    }
    
    $result = az @listArgs | ConvertFrom-Json
    
    foreach ($blob in $result) {
        $blobFiles[$blob.name] = @{
            Size = $blob.properties.contentLength
            LastModified = $blob.properties.lastModified
        }
    }
    
    # Check for continuation token (Azure CLI doesn't return it in JSON, so we'll do one fetch)
    break
} while ($nextMarker)

Write-Host "   Found $($blobFiles.Count) files in blob storage" -ForegroundColor Green

# Step 2: Get all files from local directory
Write-Host "🔍 Step 2: Scanning local directory..." -ForegroundColor Yellow
$localFiles = @{}

$allFiles = Get-ChildItem -Path $LocalPath -File -Recurse -ErrorAction SilentlyContinue

foreach ($file in $allFiles) {
    $relativePath = $file.FullName.Substring($LocalPath.Length + 1).Replace('\', '/')
    
    if ($MOVOnly -and $file.Extension -notmatch '^\.(mov|MOV)$') {
        continue
    }
    
    $localFiles[$relativePath] = @{
        FullPath = $file.FullName
        Size = $file.Length
        Extension = $file.Extension
    }
}

Write-Host "   Found $($localFiles.Count) files locally$(if ($MOVOnly) { ' (MOV only)' })" -ForegroundColor Green

# Step 3: Compare and identify differences
Write-Host "🔍 Step 3: Analyzing differences..." -ForegroundColor Yellow

$missingInBlob = @()
$missingInLocal = @()
$inBoth = @()

foreach ($localPath in $localFiles.Keys) {
    if ($blobFiles.ContainsKey($localPath)) {
        $inBoth += $localPath
    } else {
        $missingInBlob += $localPath
    }
}

foreach ($blobPath in $blobFiles.Keys) {
    if (-not $localFiles.ContainsKey($blobPath)) {
        $missingInLocal += $blobPath
    }
}

# Results
Write-Host ""
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host "AUDIT RESULTS" -ForegroundColor Cyan
Write-Host "=" * 80 -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Files in both locations:     $($inBoth.Count)" -ForegroundColor Green
Write-Host "⚠️  Missing from blob storage:  $($missingInBlob.Count)" -ForegroundColor Yellow
Write-Host "ℹ️  Missing from local:         $($missingInLocal.Count)" -ForegroundColor Cyan
Write-Host ""

if ($missingInBlob.Count -gt 0) {
    Write-Host "📋 Files missing from blob storage:" -ForegroundColor Yellow
    $missingInBlob | Select-Object -First 50 | ForEach-Object {
        $size = [math]::Round($localFiles[$_].Size / 1MB, 2)
        Write-Host "   $_" -NoNewline
        Write-Host " ($size MB)" -ForegroundColor Gray
    }
    if ($missingInBlob.Count -gt 50) {
        Write-Host "   ... and $($missingInBlob.Count - 50) more" -ForegroundColor Gray
    }
    Write-Host ""
}

if ($missingInLocal.Count -gt 0) {
    Write-Host "📋 Files in blob but not local (first 50):" -ForegroundColor Cyan
    $missingInLocal | Select-Object -First 50 | ForEach-Object {
        Write-Host "   $_"
    }
    if ($missingInLocal.Count -gt 50) {
        Write-Host "   ... and $($missingInLocal.Count - 50) more" -ForegroundColor Gray
    }
    Write-Host ""
}

# Save results
$reportPath = "scripts\media-audit-report.json"
$report = @{
    Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    LocalPath = $LocalPath
    StorageAccount = $StorageAccount
    Container = $Container
    MOVOnly = $MOVOnly.IsPresent
    InBoth = $inBoth
    MissingInBlob = $missingInBlob
    MissingInLocal = $missingInLocal
    Stats = @{
        TotalInBoth = $inBoth.Count
        TotalMissingInBlob = $missingInBlob.Count
        TotalMissingInLocal = $missingInLocal.Count
    }
}

$report | ConvertTo-Json -Depth 10 | Out-File $reportPath -Encoding UTF8
Write-Host "📄 Full report saved to: $reportPath" -ForegroundColor Green
Write-Host ""

# Step 4: Upload missing files if requested
if ($UploadMissing -and $missingInBlob.Count -gt 0) {
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "UPLOADING MISSING FILES" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host ""
    
    $uploaded = 0
    $failed = 0
    $converted = 0
    $totalSize = 0
    
    foreach ($filePath in $missingInBlob) {
        $localFile = $localFiles[$filePath]
        $fileName = Split-Path $filePath -Leaf
        $fileToUpload = $localFile.FullPath
        $uploadPath = $filePath
        $needsCleanup = $false
        
        # Convert MOV to MP4 if requested
        if ($ConvertMOVtoMP4 -and $localFile.Extension -match '^\.(mov|MOV)$') {
            Write-Host "🎬 Converting to MP4: $fileName" -ForegroundColor Cyan
            
            $mp4Path = [System.IO.Path]::ChangeExtension($localFile.FullPath, ".mp4")
            $tempMp4 = "$env:TEMP\$(Split-Path $mp4Path -Leaf)"
            
            # Convert using FFmpeg
            $ffmpegArgs = @(
                "-i", "`"$($localFile.FullPath)`"",
                "-c:v", "libx264",
                "-crf", "23",
                "-preset", "medium",
                "-c:a", "aac",
                "-b:a", "128k",
                "-movflags", "+faststart",
                "-y",
                "`"$tempMp4`""
            )
            
            $ffmpegProcess = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
            
            if ($ffmpegProcess.ExitCode -eq 0 -and (Test-Path $tempMp4)) {
                $fileToUpload = $tempMp4
                $uploadPath = $filePath -replace '\.(mov|MOV)$', '.mp4'
                $needsCleanup = $true
                $converted++
                Write-Host "   ✅ Converted successfully" -ForegroundColor Green
            } else {
                Write-Host "   ⚠️  Conversion failed, uploading original MOV" -ForegroundColor Yellow
            }
        }
        
        Write-Host "⬆️  Uploading: $uploadPath" -ForegroundColor Yellow
        
        try {
            $uploadArgs = @(
                "storage", "blob", "upload",
                "--account-name", $StorageAccount,
                "--account-key", $env:AZURE_STORAGE_KEY,
                "--container-name", $Container,
                "--name", $uploadPath,
                "--file", $fileToUpload,
                "--overwrite"
            )
            
            az @uploadArgs *>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                $uploaded++
                $totalSize += $localFile.Size
                Write-Host "   ✅ Uploaded successfully" -ForegroundColor Green
            } else {
                $failed++
                Write-Host "   ❌ Upload failed" -ForegroundColor Red
            }
        } catch {
            $failed++
            Write-Host "   ❌ Upload error: $($_.Exception.Message)" -ForegroundColor Red
        } finally {
            # Clean up temp file
            if ($needsCleanup -and (Test-Path $fileToUpload)) {
                Remove-Item $fileToUpload -Force
            }
        }
    }
    
    Write-Host ""
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "UPLOAD SUMMARY" -ForegroundColor Cyan
    Write-Host "=" * 80 -ForegroundColor Cyan
    Write-Host "Total files:     $($missingInBlob.Count)"
    Write-Host "Uploaded:        $uploaded" -ForegroundColor Green
    Write-Host "Converted:       $converted" -ForegroundColor Cyan
    Write-Host "Failed:          $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Gray" })
    Write-Host "Total size:      $([math]::Round($totalSize / 1MB, 2)) MB"
    Write-Host "=" * 80 -ForegroundColor Cyan
} elseif ($missingInBlob.Count -gt 0) {
    Write-Host "💡 To upload missing files, run with -UploadMissing switch" -ForegroundColor Cyan
    Write-Host "💡 To convert MOV to MP4 during upload, add -ConvertMOVtoMP4 switch" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "✅ Audit complete!" -ForegroundColor Green
