# Check if specific video files exist in Azure Blob Storage

$storageAccount = "famprodgajerhxssqswm"
$container = "family-album-media"

# Get storage account key from environment or prompt
$key = $env:AZURE_STORAGE_KEY
if (-not $key) {
    Write-Host "AZURE_STORAGE_KEY not set. Please enter it:"
    $key = Read-Host -AsSecureString
    $key = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($key))
}

$failingPaths = @(
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0191.MOV",
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0057.MOV",
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0080.MOV",
    "Events/Thanksgiving/Thanksgiving 2012/MVI_5287.MOV",
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0055.MOV",
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0048.MOV",
    "Events/Thanksgiving/Thanksgiving 2013/Mike/MVI_0079.MOV",
    "On Location/Milwaukee Aug 2003/P8240098.MOV",
    "On Location/Milwaukee Feb 2003/P2210046.MOV",
    "Scanned06/scn032.jpg",
    "Miscellaneous Pictures/grandkids.jpg",
    "On Location/Milwaukee2005/P6190122.MP4",
    "On Location/Charlottesville 2005/P7270013.MP4",
    "On Location/Charlottesville 2005/P7270007.MP4",
    "On Location/Milwaukee Feb 2003/P2210044.MOV"
)

Write-Host "`nChecking if files exist in Azure Blob Storage...`n" -ForegroundColor Cyan

foreach ($path in $failingPaths) {
    $filename = Split-Path $path -Leaf
    
    try {
        $result = az storage blob exists `
            --account-name $storageAccount `
            --account-key $key `
            --container-name $container `
            --name $path `
            --only-show-errors | ConvertFrom-Json
        
        if ($result.exists) {
            Write-Host "✅ EXISTS: $filename" -ForegroundColor Green
            Write-Host "   Path: $path" -ForegroundColor Gray
        } else {
            Write-Host "❌ MISSING: $filename" -ForegroundColor Red
            Write-Host "   Expected path: $path" -ForegroundColor Gray
        }
    } catch {
        Write-Host "⚠️  ERROR checking $filename : $_" -ForegroundColor Yellow
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan
