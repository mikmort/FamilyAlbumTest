# Regenerate thumbnail for a specific image
# Usage: .\regenerate-thumbnail.ps1 -filename "20250606_093248.jpg"

param(
    [Parameter(Mandatory=$true)]
    [string]$filename
)

# Load environment variables
if (Test-Path ".env.local") {
    Get-Content ".env.local" | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$siteUrl = "https://family-album.azurewebsites.net"

Write-Host "Regenerating thumbnail for: $filename" -ForegroundColor Cyan

# URL encode the filename using PowerShell's built-in method
$encodedFilename = [uri]::EscapeDataString($filename)

# Call the API with regenerate=true parameter
$url = "$siteUrl/api/media/$encodedFilename`?thumbnail=true&regenerate=true"

Write-Host "Calling: $url" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest -Uri $url -Method GET -UseBasicParsing
    Write-Host "✅ Thumbnail regenerated successfully!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error regenerating thumbnail" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
