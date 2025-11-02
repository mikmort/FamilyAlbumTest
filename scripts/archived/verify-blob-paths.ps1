# Script to check if database paths match actual blobs in Azure Storage
# This will help identify missing files or path mismatches

param(
    [int]$MaxResults = 20
)

Write-Host "=== Checking Database Paths vs Blob Storage ===" -ForegroundColor Cyan

# Load environment variables from api/local.settings.json
$localSettingsPath = "api/local.settings.json"
if (Test-Path $localSettingsPath) {
    Write-Host "Loading Azure Storage credentials..." -ForegroundColor Yellow
    $settings = Get-Content $localSettingsPath | ConvertFrom-Json
    $env:AZURE_STORAGE_ACCOUNT = $settings.Values.AZURE_STORAGE_ACCOUNT
    $env:AZURE_STORAGE_KEY = $settings.Values.AZURE_STORAGE_KEY
    $env:AZURE_STORAGE_CONTAINER = $settings.Values.AZURE_STORAGE_CONTAINER
}

if (-not $env:AZURE_STORAGE_ACCOUNT -or -not $env:AZURE_STORAGE_KEY) {
    Write-Host "ERROR: Missing Azure Storage credentials" -ForegroundColor Red
    Write-Host "Please ensure api/local.settings.json contains:" -ForegroundColor Red
    Write-Host "  AZURE_STORAGE_ACCOUNT" -ForegroundColor Yellow
    Write-Host "  AZURE_STORAGE_KEY" -ForegroundColor Yellow
    exit 1
}

Write-Host "Fetching media list from API..." -ForegroundColor Yellow
$apiUrl = "https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media"

try {
    $mediaItems = Invoke-RestMethod -Uri $apiUrl -Method Get
    
    # Filter for Devorah's Wedding items
    $devorahItems = $mediaItems | Where-Object { 
        $_.PFileName -like "*Devorah*" -or 
        $_.PFileDirectory -like "*Devorah*" 
    } | Select-Object -First $MaxResults
    
    Write-Host "`nFound $($devorahItems.Count) Devorah's Wedding items in database" -ForegroundColor Green
    Write-Host "`nChecking if files exist in blob storage...`n" -ForegroundColor Yellow
    
    # Load Azure Storage module
    Import-Module Az.Storage -ErrorAction Stop
    
    # Create storage context
    $ctx = New-AzStorageContext -StorageAccountName $env:AZURE_STORAGE_ACCOUNT -StorageAccountKey $env:AZURE_STORAGE_KEY
    
    $foundCount = 0
    $missingCount = 0
    
    foreach ($item in $devorahItems) {
        # Construct expected blob path
        $directory = $item.PFileDirectory
        $filename = $item.PFileName
        
        if ($directory -and $filename.StartsWith($directory)) {
            $blobPath = $filename
        } elseif ($directory) {
            $blobPath = "$directory/$filename"
        } else {
            $blobPath = $filename
        }
        
        # Normalize path
        $blobPath = $blobPath.Replace('\', '/').Replace('//', '/')
        
        # Check if blob exists
        try {
            $blob = Get-AzStorageBlob -Container $env:AZURE_STORAGE_CONTAINER -Blob $blobPath -Context $ctx -ErrorAction Stop
            Write-Host "✓ FOUND: $blobPath" -ForegroundColor Green
            $foundCount++
        } catch {
            Write-Host "✗ MISSING: $blobPath" -ForegroundColor Red
            Write-Host "  DB Directory: $directory" -ForegroundColor Gray
            Write-Host "  DB Filename: $filename" -ForegroundColor Gray
            $missingCount++
            
            # Try to find similar blobs
            $searchName = [System.IO.Path]::GetFileNameWithoutExtension($filename)
            $similarBlobs = Get-AzStorageBlob -Container $env:AZURE_STORAGE_CONTAINER -Context $ctx | 
                Where-Object { $_.Name -like "*$searchName*" } | 
                Select-Object -First 3
            
            if ($similarBlobs) {
                Write-Host "  Possible matches in storage:" -ForegroundColor Cyan
                foreach ($similar in $similarBlobs) {
                    Write-Host "    - $($similar.Name)" -ForegroundColor Cyan
                }
            }
            Write-Host ""
        }
    }
    
    Write-Host "`n=== Summary ===" -ForegroundColor Cyan
    Write-Host "Found: $foundCount" -ForegroundColor Green
    Write-Host "Missing: $missingCount" -ForegroundColor Red
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "`nMake sure Az.Storage module is installed:" -ForegroundColor Yellow
    Write-Host "Install-Module -Name Az.Storage -Scope CurrentUser" -ForegroundColor Yellow
}
