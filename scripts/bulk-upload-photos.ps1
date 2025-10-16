# Bulk Upload Photos to Family Album
# This script uploads photos from a local directory to Azure Blob Storage
# and adds them to the UnindexedFiles table for processing

param(
    [Parameter(Mandatory=$true)]
    [string]$SourceDirectory,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiEndpoint = "http://localhost:7071/api/upload",
    
    [Parameter(Mandatory=$false)]
    [string[]]$FileExtensions = @("*.jpg", "*.jpeg", "*.png", "*.gif", "*.bmp", "*.mp4", "*.mov", "*.avi", "*.wmv"),
    
    [Parameter(Mandatory=$false)]
    [int]$BatchSize = 10,
    
    [Parameter(Mandatory=$false)]
    [switch]$WhatIf
)

# Load environment variables from .env.local if it exists
$envFile = Join-Path $PSScriptRoot "..\..\.env.local"
if (Test-Path $envFile) {
    Write-Host "Loading environment variables from .env.local..." -ForegroundColor Cyan
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

# Validate source directory
if (-not (Test-Path $SourceDirectory)) {
    Write-Error "Source directory not found: $SourceDirectory"
    exit 1
}

Write-Host "=== Family Album Bulk Upload ===" -ForegroundColor Green
Write-Host "Source Directory: $SourceDirectory" -ForegroundColor Cyan
Write-Host "API Endpoint: $ApiEndpoint" -ForegroundColor Cyan
Write-Host "Batch Size: $BatchSize" -ForegroundColor Cyan
Write-Host ""

# Get all media files
Write-Host "Scanning for media files..." -ForegroundColor Yellow
$allFiles = @()
foreach ($ext in $FileExtensions) {
    $files = Get-ChildItem -Path $SourceDirectory -Filter $ext -Recurse -File
    $allFiles += $files
}

Write-Host "Found $($allFiles.Count) media files" -ForegroundColor Green
Write-Host ""

if ($allFiles.Count -eq 0) {
    Write-Host "No files to upload. Exiting." -ForegroundColor Yellow
    exit 0
}

# Display sample of files
Write-Host "Sample of files to upload:" -ForegroundColor Cyan
$allFiles | Select-Object -First 5 | ForEach-Object {
    Write-Host "  - $($_.FullName)" -ForegroundColor Gray
}
if ($allFiles.Count -gt 5) {
    Write-Host "  ... and $($allFiles.Count - 5) more" -ForegroundColor Gray
}
Write-Host ""

if ($WhatIf) {
    Write-Host "WhatIf mode - no files will be uploaded" -ForegroundColor Yellow
    exit 0
}

# Confirm upload
$confirmation = Read-Host "Do you want to proceed with the upload? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Upload cancelled." -ForegroundColor Yellow
    exit 0
}

# Upload files
$successCount = 0
$failureCount = 0
$totalFiles = $allFiles.Count
$currentFile = 0

Write-Host ""
Write-Host "Starting upload..." -ForegroundColor Green
Write-Host ""

foreach ($file in $allFiles) {
    $currentFile++
    $percentComplete = [math]::Round(($currentFile / $totalFiles) * 100, 2)
    
    try {
        Write-Host "[$currentFile/$totalFiles] ($percentComplete%) Uploading: $($file.Name)" -ForegroundColor Cyan
        
        # Get relative path from source directory
        $relativePath = $file.FullName.Substring($SourceDirectory.Length).TrimStart('\', '/')
        $directory = Split-Path $relativePath -Parent
        
        # Determine content type
        $contentType = switch ($file.Extension.ToLower()) {
            ".jpg"  { "image/jpeg" }
            ".jpeg" { "image/jpeg" }
            ".png"  { "image/png" }
            ".gif"  { "image/gif" }
            ".bmp"  { "image/bmp" }
            ".mp4"  { "video/mp4" }
            ".mov"  { "video/quicktime" }
            ".avi"  { "video/x-msvideo" }
            ".wmv"  { "video/x-ms-wmv" }
            default { "application/octet-stream" }
        }
        
        # Read file and convert to base64
        $fileBytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $base64Content = [System.Convert]::ToBase64String($fileBytes)
        
        # Create request body
        $body = @{
            fileName = $file.Name
            fileData = $base64Content
            contentType = $contentType
            directory = $directory
        } | ConvertTo-Json
        
        # Upload to API
        $response = Invoke-RestMethod -Uri $ApiEndpoint -Method Post -Body $body -ContentType "application/json" -TimeoutSec 300
        
        if ($response.success) {
            Write-Host "  [OK] Success: $($response.fileName)" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  [FAIL] Failed: $($response.error)" -ForegroundColor Red
            $failureCount++
        }
        
        # Add small delay between uploads to avoid overwhelming the API
        Start-Sleep -Milliseconds 100
        
    } catch {
        Write-Host "  [ERROR] Error: $($_.Exception.Message)" -ForegroundColor Red
        $failureCount++
    }
}

# Summary
Write-Host ""
Write-Host "=== Upload Complete ===" -ForegroundColor Green
Write-Host "Total files: $totalFiles" -ForegroundColor Cyan
Write-Host "Successful: $successCount" -ForegroundColor Green
Write-Host "Failed: $failureCount" -ForegroundColor Red
Write-Host ""

if ($failureCount -gt 0) {
    Write-Host "Some files failed to upload. Check the logs above for details." -ForegroundColor Yellow
}
