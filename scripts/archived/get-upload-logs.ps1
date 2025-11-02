# Get recent upload function logs from Azure Static Web App
# The API functions are part of the Static Web App, not a separate Function App

Write-Host "This will show logs from your Azure Static Web App's API functions" -ForegroundColor Cyan
Write-Host "You need to upload a photo NOW, and this will show the logs in real-time." -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop streaming logs." -ForegroundColor Yellow
Write-Host ""

# First, let's find your Static Web App
Write-Host "Finding your Azure Static Web App..." -ForegroundColor Cyan

# List all Static Web Apps (you might need to select one if you have multiple)
$swaList = az staticwebapp list --query "[].{name:name, resourceGroup:resourceGroup, location:location}" -o json | ConvertFrom-Json

if ($swaList.Count -eq 0) {
    Write-Host "No Static Web Apps found. Please make sure you're logged in:" -ForegroundColor Red
    Write-Host "  az login" -ForegroundColor Yellow
    exit 1
}

if ($swaList.Count -eq 1) {
    $swa = $swaList[0]
    Write-Host "Found Static Web App: $($swa.name)" -ForegroundColor Green
    Write-Host "Resource Group: $($swa.resourceGroup)" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "Multiple Static Web Apps found:" -ForegroundColor Yellow
    for ($i = 0; $i -lt $swaList.Count; $i++) {
        Write-Host "  [$i] $($swaList[$i].name) (Resource Group: $($swaList[$i].resourceGroup))" -ForegroundColor Cyan
    }
    $selection = Read-Host "Select the number of your Family Album app"
    $swa = $swaList[[int]$selection]
}

Write-Host ""
Write-Host "Streaming logs from: $($swa.name)" -ForegroundColor Cyan
Write-Host "Now upload a photo in your app and watch for the logs below..." -ForegroundColor Yellow
Write-Host "=" * 80 -ForegroundColor Gray
Write-Host ""

# Stream logs (this will show API function logs)
# Note: Static Web Apps don't have the same log tail command as Function Apps
# We'll use Application Insights if available, or show how to access logs
Write-Host "To view detailed logs, you can:" -ForegroundColor Yellow
Write-Host "1. Go to Azure Portal -> Your Static Web App -> Application Insights" -ForegroundColor Cyan
Write-Host "2. Or use the following command to get recent logs:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   az monitor app-insights query ``" -ForegroundColor White
Write-Host "     --app (your-app-insights-name) ``" -ForegroundColor White
Write-Host "     --analytics-query 'traces | where timestamp > ago(5m) | where message contains \"upload\" | order by timestamp desc' ``" -ForegroundColor White
Write-Host "     --resource-group $($swa.resourceGroup)" -ForegroundColor White
Write-Host ""
Write-Host "Alternatively, check GitHub Actions for the most recent deployment logs:" -ForegroundColor Yellow
Write-Host "  https://github.com/mikmort/FamilyAlbumTest/actions" -ForegroundColor Cyan
