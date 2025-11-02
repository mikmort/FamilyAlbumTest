# Convert old MOV/video files to modern MP4 format with H.264 codec
# This script downloads MOV files from Azure Blob Storage, converts them to MP4,
# and uploads the converted versions back to storage

param(
    [switch]$DryRun,
    [string]$Filter = "*.MOV",
    [int]$MaxConcurrent = 3
)

$ErrorActionPreference = "Stop"

# Check if ffmpeg is installed
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "✅ FFmpeg found: $ffmpegVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ FFmpeg not found. Please install FFmpeg:" -ForegroundColor Red
    Write-Host "   winget install Gyan.FFmpeg" -ForegroundColor Yellow
    Write-Host "   or download from https://ffmpeg.org/download.html" -ForegroundColor Yellow
    exit 1
}

# Azure Storage configuration
$storageAccount = "famprodgajerhxssqswm"
$container = "family-album-media"

# Get storage account key from environment
$key = $env:AZURE_STORAGE_KEY
if (-not $key) {
    Write-Host "❌ AZURE_STORAGE_KEY environment variable not set" -ForegroundColor Red
    Write-Host "   Set it with: `$env:AZURE_STORAGE_KEY = 'your-key-here'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n$('='*80)" -ForegroundColor Cyan
Write-Host "Video Conversion Script" -ForegroundColor Cyan
Write-Host "='*80" -ForegroundColor Cyan
Write-Host "Storage Account: $storageAccount" -ForegroundColor Gray
Write-Host "Container:       $container" -ForegroundColor Gray
Write-Host "Filter:          $Filter" -ForegroundColor Gray
Write-Host "Dry Run:         $DryRun" -ForegroundColor Gray
Write-Host "='*80`n" -ForegroundColor Cyan

# Create temp directory for conversions
$tempDir = Join-Path $env:TEMP "video-conversion-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host "📁 Temp directory: $tempDir`n" -ForegroundColor Gray

# Get list of all MOV files
Write-Host "🔍 Finding MOV files in blob storage..." -ForegroundColor Cyan
$movFiles = az storage blob list `
    --account-name $storageAccount `
    --account-key $key `
    --container-name $container `
    --query "[?ends_with(name, '.MOV') || ends_with(name, '.mov')].{name:name,size:properties.contentLength}" `
    --output json `
    --only-show-errors | ConvertFrom-Json

if (-not $movFiles -or $movFiles.Count -eq 0) {
    Write-Host "No MOV files found." -ForegroundColor Yellow
    Remove-Item $tempDir -Recurse -Force
    exit 0
}

Write-Host "Found $($movFiles.Count) MOV files`n" -ForegroundColor Green

$converted = 0
$skipped = 0
$failed = 0
$totalSizeBefore = 0
$totalSizeAfter = 0

foreach ($blob in $movFiles) {
    $blobName = $blob.name
    $originalSize = [long]$blob.size
    $totalSizeBefore += $originalSize
    
    # Generate MP4 filename (replace .MOV/.mov with .mp4)
    $mp4Name = $blobName -replace '\.MOV$|\.mov$', '.mp4'
    
    Write-Host "$('─'*80)" -ForegroundColor DarkGray
    Write-Host "📹 $blobName" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($originalSize/1MB, 2)) MB" -ForegroundColor Gray
    
    # Check if MP4 version already exists
    $mp4Exists = az storage blob exists `
        --account-name $storageAccount `
        --account-key $key `
        --container-name $container `
        --name $mp4Name `
        --only-show-errors | ConvertFrom-Json
    
    if ($mp4Exists.exists) {
        Write-Host "   ⏭️  MP4 version already exists, skipping" -ForegroundColor Yellow
        $skipped++
        continue
    }
    
    if ($DryRun) {
        Write-Host "   🔄 Would convert to: $mp4Name" -ForegroundColor Cyan
        $skipped++
        continue
    }
    
    try {
        # Download original file
        $inputFile = Join-Path $tempDir ([System.IO.Path]::GetFileName($blobName))
        $outputFile = Join-Path $tempDir ([System.IO.Path]::GetFileName($mp4Name))
        
        Write-Host "   ⬇️  Downloading..." -ForegroundColor Cyan
        az storage blob download `
            --account-name $storageAccount `
            --account-key $key `
            --container-name $container `
            --name $blobName `
            --file $inputFile `
            --only-show-errors | Out-Null
        
        # Convert to MP4 with H.264 codec
        Write-Host "   🔄 Converting to MP4 (H.264)..." -ForegroundColor Cyan
        
        # FFmpeg conversion with optimal settings for web playback:
        # -c:v libx264: H.264 codec (universally supported)
        # -crf 23: Quality (18=high quality, 28=lower quality, 23=balanced)
        # -preset medium: Encoding speed vs compression (fast/medium/slow)
        # -c:a aac: AAC audio codec
        # -b:a 128k: Audio bitrate
        # -movflags +faststart: Enable fast start for web streaming
        # -y: Overwrite output file
        
        $ffmpegArgs = @(
            "-i", $inputFile,
            "-c:v", "libx264",
            "-crf", "23",
            "-preset", "medium",
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",
            "-y",
            $outputFile
        )
        
        $process = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru
        
        if ($process.ExitCode -ne 0) {
            throw "FFmpeg conversion failed with exit code $($process.ExitCode)"
        }
        
        if (-not (Test-Path $outputFile)) {
            throw "Output file was not created"
        }
        
        $outputSize = (Get-Item $outputFile).Length
        $totalSizeAfter += $outputSize
        $compressionRatio = [math]::Round((1 - ($outputSize / $originalSize)) * 100, 1)
        
        Write-Host "   ✅ Converted: $([math]::Round($outputSize/1MB, 2)) MB (saved $compressionRatio%)" -ForegroundColor Green
        
        # Upload converted file
        Write-Host "   ⬆️  Uploading to blob storage..." -ForegroundColor Cyan
        az storage blob upload `
            --account-name $storageAccount `
            --account-key $key `
            --container-name $container `
            --name $mp4Name `
            --file $outputFile `
            --content-type "video/mp4" `
            --only-show-errors | Out-Null
        
        Write-Host "   ✅ Uploaded as: $mp4Name" -ForegroundColor Green
        
        # Clean up temp files
        Remove-Item $inputFile -Force -ErrorAction SilentlyContinue
        Remove-Item $outputFile -Force -ErrorAction SilentlyContinue
        
        $converted++
        
    } catch {
        Write-Host "   ❌ Error: $_" -ForegroundColor Red
        $failed++
        
        # Clean up on error
        if (Test-Path $inputFile) { Remove-Item $inputFile -Force -ErrorAction SilentlyContinue }
        if (Test-Path $outputFile) { Remove-Item $outputFile -Force -ErrorAction SilentlyContinue }
    }
}

# Cleanup temp directory
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Summary
Write-Host "`n$('='*80)" -ForegroundColor Cyan
Write-Host "CONVERSION SUMMARY" -ForegroundColor Cyan
Write-Host "='*80" -ForegroundColor Cyan
Write-Host "Total MOV files found:  $($movFiles.Count)" -ForegroundColor White
Write-Host "Successfully converted: $converted" -ForegroundColor Green
Write-Host "Skipped:                $skipped" -ForegroundColor Yellow
Write-Host "Failed:                 $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "White" })

if ($converted -gt 0) {
    $avgCompression = [math]::Round((1 - ($totalSizeAfter / $totalSizeBefore)) * 100, 1)
    Write-Host "`nStorage Impact:" -ForegroundColor White
    Write-Host "  Original size: $([math]::Round($totalSizeBefore/1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "  New size:      $([math]::Round($totalSizeAfter/1MB, 2)) MB" -ForegroundColor Gray
    Write-Host "  Saved:         $([math]::Round(($totalSizeBefore - $totalSizeAfter)/1MB, 2)) MB ($avgCompression%)" -ForegroundColor Green
}

Write-Host "='*80`n" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host "This was a dry run. Run without -DryRun to perform conversions." -ForegroundColor Yellow
}
