# Script to regenerate thumbnails for existing videos
# Run this after deployment to fix videos that don't have thumbnails

$apiUrl = "https://your-static-web-app.azurestaticapps.net/api/regenerate-video-thumbnails"

# You can also use localhost if testing locally
# $apiUrl = "http://localhost:7071/api/regenerate-video-thumbnails"

Write-Host "Regenerating video thumbnails..." -ForegroundColor Cyan
Write-Host "API URL: $apiUrl" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-RestMethod -Uri $apiUrl -Method Post -ContentType "application/json"
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Results:" -ForegroundColor Cyan
    Write-Host "  Processed: $($response.results.success + $response.results.failed) videos" -ForegroundColor White
    Write-Host "  Success: $($response.results.success)" -ForegroundColor Green
    Write-Host "  Failed: $($response.results.failed)" -ForegroundColor Red
    
    if ($response.results.failed -gt 0) {
        Write-Host ""
        Write-Host "Errors:" -ForegroundColor Red
        foreach ($error in $response.results.errors) {
            Write-Host "  - $($error.fileName): $($error.error)" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "❌ Error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host ""
        Write-Host "Details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Cyan
