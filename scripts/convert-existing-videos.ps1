# Script to convert existing .AVI and .MOV files to .MP4 in Azure Blob Storage
# This script:
# 1. Lists all .avi and .mov files in blob storage
# 2. Downloads each file
# 3. Converts to MP4 using FFmpeg
# 4. Uploads as .mp4 with correct Content-Type
# 5. Updates database records
# 6. Deletes old file

param(
    [switch]$DryRun = $false,  # If set, only shows what would be done without making changes
    [switch]$Force = $false     # If set, skips confirmation prompts
)

$ErrorActionPreference = "Stop"

# Configuration
$storageAccount = $env:AZURE_STORAGE_ACCOUNT
$storageKey = $env:AZURE_STORAGE_KEY
$containerName = "family-album-media"

# Database connection (read from environment or configure here)
$sqlServer = $env:SQL_SERVER
$sqlDatabase = $env:SQL_DATABASE
$sqlUser = $env:SQL_USER
$sqlPassword = $env:SQL_PASSWORD

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Convert Existing Videos to MP4" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Check if FFmpeg is available
try {
    $ffmpegVersion = ffmpeg -version 2>&1 | Select-Object -First 1
    Write-Host "FFmpeg found: $ffmpegVersion" -ForegroundColor Green
} catch {
    Write-Host "ERROR: FFmpeg not found. Please install FFmpeg first." -ForegroundColor Red
    Write-Host "Download from: https://ffmpeg.org/download.html" -ForegroundColor Yellow
    exit 1
}

# Check Azure CLI
try {
    $azVersion = az version --output json | ConvertFrom-Json
    Write-Host "Azure CLI found: $($azVersion.'azure-cli')" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Azure CLI not found. Please install Azure CLI first." -ForegroundColor Red
    exit 1
}

Write-Host ""

# List all video files that need conversion
Write-Host "Searching for .avi and .mov files..." -ForegroundColor Cyan
$aviFiles = az storage blob list `
    --account-name $storageAccount `
    --container-name $containerName `
    --query "[?ends_with(name, '.avi') || ends_with(name, '.AVI')].name" `
    --output json | ConvertFrom-Json

$movFiles = az storage blob list `
    --account-name $storageAccount `
    --container-name $containerName `
    --query "[?ends_with(name, '.mov') || ends_with(name, '.MOV')].name" `
    --output json | ConvertFrom-Json

$allFiles = @()
if ($aviFiles) { $allFiles += $aviFiles }
if ($movFiles) { $allFiles += $movFiles }

if ($allFiles.Count -eq 0) {
    Write-Host "No .avi or .mov files found. Nothing to convert." -ForegroundColor Green
    exit 0
}

Write-Host "Found $($allFiles.Count) files to convert:" -ForegroundColor Yellow
$allFiles | ForEach-Object { Write-Host "  - $_" }
Write-Host ""

if (-not $Force -and -not $DryRun) {
    $confirm = Read-Host "Continue with conversion? (yes/no)"
    if ($confirm -ne "yes") {
        Write-Host "Cancelled by user." -ForegroundColor Yellow
        exit 0
    }
}

# Create temp directory
$tempDir = Join-Path $env:TEMP "video-conversion-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
Write-Host "Using temp directory: $tempDir" -ForegroundColor Gray
Write-Host ""

$successCount = 0
$failCount = 0
$skippedCount = 0

foreach ($blobName in $allFiles) {
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    Write-Host "Processing: $blobName" -ForegroundColor White
    
    try {
        # Determine file extension
        $extension = [System.IO.Path]::GetExtension($blobName).ToLower()
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($blobName)
        $newName = "$baseName.mp4"
        
        # Check if MP4 version already exists
        $mp4Exists = az storage blob exists `
            --account-name $storageAccount `
            --container-name $containerName `
            --name $newName `
            --query "exists" `
            --output tsv
        
        if ($mp4Exists -eq "true") {
            Write-Host "  ⚠️  MP4 version already exists: $newName" -ForegroundColor Yellow
            Write-Host "  Skipping conversion (use -Force to overwrite)" -ForegroundColor Yellow
            $skippedCount++
            continue
        }
        
        if ($DryRun) {
            Write-Host "  [DRY RUN] Would convert: $blobName -> $newName" -ForegroundColor Yellow
            $successCount++
            continue
        }
        
        # Download original file
        $inputPath = Join-Path $tempDir "input$extension"
        Write-Host "  Downloading..." -ForegroundColor Gray
        az storage blob download `
            --account-name $storageAccount `
            --container-name $containerName `
            --name $blobName `
            --file $inputPath `
            --output none
        
        $inputSize = (Get-Item $inputPath).Length
        Write-Host "  Downloaded: $([math]::Round($inputSize/1MB, 2)) MB" -ForegroundColor Gray
        
        # Convert to MP4
        $outputPath = Join-Path $tempDir "output.mp4"
        Write-Host "  Converting to MP4..." -ForegroundColor Gray
        
        $ffmpegArgs = @(
            "-i", $inputPath,
            "-c:v", "libx264",
            "-c:a", "aac",
            "-movflags", "+faststart",
            "-pix_fmt", "yuv420p",
            "-preset", "fast",
            "-crf", "23",
            "-y",  # Overwrite output
            $outputPath
        )
        
        $ffmpegProcess = Start-Process -FilePath "ffmpeg" -ArgumentList $ffmpegArgs -Wait -PassThru -NoNewWindow
        
        if ($ffmpegProcess.ExitCode -ne 0) {
            throw "FFmpeg conversion failed with exit code $($ffmpegProcess.ExitCode)"
        }
        
        $outputSize = (Get-Item $outputPath).Length
        Write-Host "  Converted: $([math]::Round($outputSize/1MB, 2)) MB" -ForegroundColor Gray
        
        # Upload MP4
        Write-Host "  Uploading MP4..." -ForegroundColor Gray
        az storage blob upload `
            --account-name $storageAccount `
            --container-name $containerName `
            --name $newName `
            --file $outputPath `
            --content-type "video/mp4" `
            --overwrite `
            --output none
        
        Write-Host "  ✓ Uploaded: $newName" -ForegroundColor Green
        
        # Update database (if SQL credentials provided)
        if ($sqlServer -and $sqlDatabase) {
            Write-Host "  Updating database..." -ForegroundColor Gray
            
            $connectionString = "Server=$sqlServer;Database=$sqlDatabase;User Id=$sqlUser;Password=$sqlPassword;Encrypt=True;TrustServerCertificate=False;"
            
            # Update Pictures table
            $updateQuery = @"
UPDATE dbo.Pictures 
SET PFileName = '$newName'
WHERE PFileName = '$blobName'
"@
            
            # Update NamePhoto table
            $updateQuery2 = @"
UPDATE dbo.NamePhoto 
SET npFileName = '$newName'
WHERE npFileName = '$blobName'
"@
            
            # Execute using sqlcmd or Invoke-Sqlcmd if available
            try {
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $updateQuery -ErrorAction Stop
                Invoke-Sqlcmd -ConnectionString $connectionString -Query $updateQuery2 -ErrorAction Stop
                Write-Host "  ✓ Database updated" -ForegroundColor Green
            } catch {
                Write-Host "  ⚠️  Database update failed: $_" -ForegroundColor Yellow
                Write-Host "     You'll need to manually update the database." -ForegroundColor Yellow
            }
        }
        
        # Delete original file
        Write-Host "  Deleting original file..." -ForegroundColor Gray
        az storage blob delete `
            --account-name $storageAccount `
            --container-name $containerName `
            --name $blobName `
            --output none
        
        Write-Host "  ✓ Deleted: $blobName" -ForegroundColor Green
        
        # Clean up temp files
        Remove-Item $inputPath -Force -ErrorAction SilentlyContinue
        Remove-Item $outputPath -Force -ErrorAction SilentlyContinue
        
        Write-Host "✓ Successfully converted: $blobName -> $newName" -ForegroundColor Green
        $successCount++
        
    } catch {
        Write-Host "✗ Failed to convert $blobName : $_" -ForegroundColor Red
        $failCount++
        
        # Clean up temp files on error
        Remove-Item (Join-Path $tempDir "input*") -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $tempDir "output.mp4") -Force -ErrorAction SilentlyContinue
    }
}

# Clean up temp directory
Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Conversion Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Success: $successCount" -ForegroundColor Green
Write-Host "Failed:  $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Gray" })
Write-Host "Skipped: $skippedCount" -ForegroundColor Yellow
Write-Host ""

if ($failCount -gt 0) {
    exit 1
}
