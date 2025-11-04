# Test script to verify video upload date extraction
# This queries the most recent uploads to see if dates are being captured

Write-Host "=== Recent Video Uploads ===" -ForegroundColor Cyan
Write-Host ""

# You'll need to set these environment variables or replace with your values
$server = $env:AZURE_SQL_SERVER
$database = $env:AZURE_SQL_DATABASE  
$user = $env:AZURE_SQL_USER
$password = $env:AZURE_SQL_PASSWORD

if (-not $server) {
    Write-Host "ERROR: AZURE_SQL_SERVER environment variable not set" -ForegroundColor Red
    Write-Host "Please run from project root where .env.local is loaded" -ForegroundColor Yellow
    exit 1
}

$connectionString = "Server=$server;Database=$database;User Id=$user;Password=$password;Encrypt=true;TrustServerCertificate=false;"

$query = @"
SELECT TOP 5
    uiID,
    uiFileName,
    uiType,
    uiMonth,
    uiYear,
    uiWidth,
    uiHeight,
    uiVtime,
    uiDateEntered,
    uiThumbUrl
FROM dbo.UnindexedFiles
ORDER BY uiDateEntered DESC
"@

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    
    $adapter = New-Object System.Data.SqlClient.SqlDataAdapter($command)
    $dataset = New-Object System.Data.DataSet
    $adapter.Fill($dataset) | Out-Null
    
    $results = $dataset.Tables[0]
    
    if ($results.Rows.Count -eq 0) {
        Write-Host "No files found in UnindexedFiles table" -ForegroundColor Yellow
    } else {
        foreach ($row in $results.Rows) {
            $typeLabel = if ($row.uiType -eq 1) { "IMAGE" } else { "VIDEO" }
            $dateStatus = if ($row.uiMonth -and $row.uiYear) {
                "✅ Date: $($row.uiMonth)/$($row.uiYear)"
            } else {
                "❌ NO DATE"
            }
            
            Write-Host "[$typeLabel] $($row.uiFileName)" -ForegroundColor $(if ($row.uiType -eq 2) { "Magenta" } else { "Green" })
            Write-Host "  $dateStatus" -ForegroundColor $(if ($row.uiMonth) { "Green" } else { "Red" })
            if ($row.uiWidth -and $row.uiHeight) {
                Write-Host "  Dimensions: $($row.uiWidth)x$($row.uiHeight)" -ForegroundColor Gray
            }
            if ($row.uiVtime) {
                Write-Host "  Duration: $($row.uiVtime)s" -ForegroundColor Gray
            }
            Write-Host "  Uploaded: $($row.uiDateEntered)" -ForegroundColor Gray
            Write-Host ""
        }
    }
    
    $connection.Close()
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "=== Analysis ===" -ForegroundColor Cyan
$videoCount = ($results.Rows | Where-Object { $_.uiType -eq 2 }).Count
$videosWithDates = ($results.Rows | Where-Object { $_.uiType -eq 2 -and $_.uiMonth -and $_.uiYear }).Count

if ($videoCount -gt 0) {
    Write-Host "Videos found: $videoCount" -ForegroundColor Yellow
    Write-Host "Videos with dates: $videosWithDates" -ForegroundColor $(if ($videosWithDates -eq $videoCount) { "Green" } else { "Red" })
    
    if ($videosWithDates -lt $videoCount) {
        Write-Host ""
        Write-Host "⚠️  Some videos are missing dates!" -ForegroundColor Red
        Write-Host "This means the video metadata extraction is still failing." -ForegroundColor Yellow
    } else {
        Write-Host ""
        Write-Host "✅ All videos have dates! Upload working correctly." -ForegroundColor Green
    }
}
