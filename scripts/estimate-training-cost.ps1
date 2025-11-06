# Estimate Face Recognition Training Costs
# This script queries your database to calculate exact training costs with smart sampling

Write-Host "🧮 Face Recognition Training Cost Estimator" -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Load environment variables
if (Test-Path .env.local) {
    Get-Content .env.local | ForEach-Object {
        if ($_ -match '^([^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, 'Process')
        }
    }
    Write-Host "Loaded environment variables from .env.local`n" -ForegroundColor Green
} else {
    Write-Host "No .env.local file found. Using environment variables." -ForegroundColor Yellow
}

# Get database connection details
$server = $env:AZURE_SQL_SERVER
$database = $env:AZURE_SQL_DATABASE
$username = $env:AZURE_SQL_USER
$password = $env:AZURE_SQL_PASSWORD

if (-not $server -or -not $database) {
    Write-Host "Error: Database connection details not found in environment variables." -ForegroundColor Red
    Write-Host "Required: AZURE_SQL_SERVER, AZURE_SQL_DATABASE, AZURE_SQL_USER, AZURE_SQL_PASSWORD" -ForegroundColor Red
    exit 1
}

Write-Host "Connecting to database..." -ForegroundColor Yellow
Write-Host "Server: $server" -ForegroundColor Gray
Write-Host "Database: $database`n" -ForegroundColor Gray

# Build connection string
$connectionString = "Server=tcp:$server,1433;Initial Catalog=$database;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    # Create SQL connection
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    Write-Host "Connected to database successfully`n" -ForegroundColor Green
    
    # Query 1: Get statistics per person
    $query1 = @"
    SELECT 
        ne.ID,
        ne.neName as PersonName,
        COUNT(DISTINCT fe.FaceID) as ConfirmedFaces
    FROM dbo.NameEvent ne
    INNER JOIN dbo.FaceEncodings fe ON ne.ID = fe.PersonID
    WHERE fe.IsConfirmed = 1 AND ne.neType = 'N'
    GROUP BY ne.ID, ne.neName
    ORDER BY ConfirmedFaces DESC
"@
    
    $command1 = $connection.CreateCommand()
    $command1.CommandText = $query1
    $adapter1 = New-Object System.Data.SqlClient.SqlDataAdapter $command1
    $dataset1 = New-Object System.Data.DataSet
    $adapter1.Fill($dataset1) | Out-Null
    
    $people = $dataset1.Tables[0]
    
    if ($people.Rows.Count -eq 0) {
        Write-Host "No confirmed face encodings found in database." -ForegroundColor Yellow
        Write-Host "You need to confirm some face matches before training." -ForegroundColor Yellow
        $connection.Close()
        exit 0
    }
    
    Write-Host "📊 Training Statistics" -ForegroundColor Cyan
    Write-Host "=====================`n" -ForegroundColor Cyan
    
    # Function to calculate smart sample size
    function Get-SampleSize {
        param([int]$totalFaces)
        
        if ($totalFaces -le 10) {
            return $totalFaces
        }
        
        $sampleSize = [Math]::Floor(10 + 20 * [Math]::Log10($totalFaces))
        $sampleSize = [Math]::Min($sampleSize, 120)
        return [Math]::Min($sampleSize, $totalFaces)
    }
    
    # Calculate costs
    $totalPeople = $people.Rows.Count
    $totalFaces = 0
    $totalSamples = 0
    $peopleDetails = @()
    
    foreach ($row in $people.Rows) {
        $personName = $row["PersonName"]
        $confirmedFaces = $row["ConfirmedFaces"]
        $sampleSize = Get-SampleSize -totalFaces $confirmedFaces
        $percentage = [Math]::Round(($sampleSize / $confirmedFaces) * 100, 1)
        
        $totalFaces += $confirmedFaces
        $totalSamples += $sampleSize
        
        $peopleDetails += [PSCustomObject]@{
            Name = $personName
            TotalFaces = $confirmedFaces
            SampleSize = $sampleSize
            Percentage = $percentage
        }
    }
    
    Write-Host "Total People: $totalPeople" -ForegroundColor White
    Write-Host "Total Confirmed Faces: $totalFaces" -ForegroundColor White
    Write-Host "Faces to Process (with sampling): $totalSamples" -ForegroundColor Green
    $reductionPercent = [Math]::Round((1 - $totalSamples/$totalFaces) * 100, 1)
    $reductionFaces = $totalFaces - $totalSamples
    Write-Host "Reduction: $reductionFaces faces saved - $reductionPercent percent reduction" -ForegroundColor Green
    Write-Host ""
    
    # Show top 10 people
    Write-Host "📋 Top 10 People by Photo Count" -ForegroundColor Cyan
    Write-Host "================================`n" -ForegroundColor Cyan
    
    $top10 = $peopleDetails | Sort-Object -Property TotalFaces -Descending | Select-Object -First 10
    
    Write-Host ("{0,-25} {1,10} {2,10} {3,10}" -f "Name", "Total", "Sample", "% Used") -ForegroundColor Yellow
    Write-Host ("{0,-25} {1,10} {2,10} {3,10}" -f "----", "-----", "------", "------") -ForegroundColor Yellow
    
    foreach ($person in $top10) {
        Write-Host ("{0,-25} {1,10} {2,10} {3,9}%" -f 
            $person.Name, 
            $person.TotalFaces, 
            $person.SampleSize, 
            $person.Percentage) -ForegroundColor White
    }
    
    # Cost calculations
    Write-Host "`n💰 Cost Estimates" -ForegroundColor Cyan
    Write-Host "================`n" -ForegroundColor Cyan
    
    # Azure Functions pricing
    $secondsPerFace = 3  # Estimated processing time per face
    $memoryGB = 1.0  # Memory allocation
    $costPerGBSecond = 0.000016  # Azure Functions Consumption pricing
    $freeGBSeconds = 400000  # Free tier monthly
    
    # Calculate execution time
    $totalSeconds = $totalSamples * $secondsPerFace
    $totalMinutes = [Math]::Round($totalSeconds / 60, 1)
    $totalHours = [Math]::Round($totalSeconds / 3600, 2)
    
    # Calculate GB-seconds
    $gbSeconds = $totalSeconds * $memoryGB
    
    # Calculate cost
    $billableGBSeconds = [Math]::Max(0, $gbSeconds - $freeGBSeconds)
    $cost = $billableGBSeconds * $costPerGBSecond
    
    Write-Host "Processing Time:" -ForegroundColor Yellow
    Write-Host "  • Per face: $secondsPerFace seconds" -ForegroundColor White
    Write-Host "  • Total faces to process: $totalSamples" -ForegroundColor White
    Write-Host "  • Total time: $totalSeconds seconds ($totalMinutes minutes)" -ForegroundColor White
    
    Write-Host "`nResource Usage:" -ForegroundColor Yellow
    Write-Host "  • Memory: $memoryGB GB" -ForegroundColor White
    Write-Host "  • GB-seconds: $gbSeconds" -ForegroundColor White
    
    Write-Host "`nCost Breakdown:" -ForegroundColor Yellow
    Write-Host "  • Azure Functions rate: `$$costPerGBSecond per GB-second" -ForegroundColor White
    Write-Host "  • Free tier: $freeGBSeconds GB-seconds/month" -ForegroundColor White
    Write-Host "  • Billable GB-seconds: $billableGBSeconds" -ForegroundColor White
    
    if ($cost -eq 0) {
        Write-Host "`nEstimated Cost: FREE (within free tier)" -ForegroundColor Green -BackgroundColor DarkGreen
        Write-Host "   Your training is covered by Azure's free tier!" -ForegroundColor Green
    } else {
        Write-Host "`nEstimated Cost: `$$([Math]::Round($cost, 2))" -ForegroundColor Green -BackgroundColor DarkGreen
    }
    
    # Compare with/without sampling
    Write-Host "`n📈 Savings from Smart Sampling" -ForegroundColor Cyan
    Write-Host "==============================`n" -ForegroundColor Cyan
    
    $withoutSamplingSeconds = $totalFaces * $secondsPerFace
    $withoutSamplingMinutes = [Math]::Round($withoutSamplingSeconds / 60, 1)
    $withoutSamplingGBSeconds = $withoutSamplingSeconds * $memoryGB
    $withoutSamplingCost = [Math]::Max(0, $withoutSamplingGBSeconds - $freeGBSeconds) * $costPerGBSecond
    
    $timeSaved = $withoutSamplingSeconds - $totalSeconds
    $timeSavedMinutes = [Math]::Round($timeSaved / 60, 1)
    $costSaved = $withoutSamplingCost - $cost
    
    Write-Host "Without Sampling:" -ForegroundColor Yellow
    Write-Host "  • Faces to process: $totalFaces" -ForegroundColor White
    Write-Host "  • Time: $withoutSamplingMinutes minutes" -ForegroundColor White
    Write-Host "  • Cost: `$$([Math]::Round($withoutSamplingCost, 2))" -ForegroundColor White
    
    Write-Host "`nWith Smart Sampling:" -ForegroundColor Yellow
    Write-Host "  • Faces to process: $totalSamples" -ForegroundColor White
    Write-Host "  • Time: $totalMinutes minutes" -ForegroundColor White
    Write-Host "  • Cost: `$$([Math]::Round($cost, 2))" -ForegroundColor White
    
    Write-Host "`nSavings:" -ForegroundColor Green
    $timeSavedPercent = [Math]::Round(($timeSaved / $withoutSamplingSeconds) * 100, 1)
    Write-Host "  Time saved: $timeSavedMinutes minutes - $timeSavedPercent percent reduction" -ForegroundColor Green
    Write-Host "  Cost saved: `$$([Math]::Round($costSaved, 2))" -ForegroundColor Green
    
    # Additional costs
    Write-Host "`n📌 Additional Considerations" -ForegroundColor Cyan
    Write-Host "============================`n" -ForegroundColor Cyan
    
    Write-Host "Other Azure costs (minimal):" -ForegroundColor Yellow
    Write-Host "  • Blob Storage reads: ~`$0.004 per 10,000 reads (negligible)" -ForegroundColor White
    Write-Host "  • SQL Database queries: Included in database pricing" -ForegroundColor White
    Write-Host "  • Outbound data: First 5GB free (unlikely to exceed)" -ForegroundColor White
    
    Write-Host "`n✨ Summary" -ForegroundColor Cyan
    Write-Host "=========`n" -ForegroundColor Cyan
    
    if ($cost -eq 0) {
        Write-Host "Your 'Train Now' operation will be FREE!" -ForegroundColor Green
        Write-Host "Processing $totalSamples faces across $totalPeople people in ~$totalMinutes minutes." -ForegroundColor White
    } else {
        Write-Host "Your 'Train Now' operation will cost approximately `$$([Math]::Round($cost, 2))" -ForegroundColor Green
        Write-Host "Processing $totalSamples faces across $totalPeople people in ~$totalMinutes minutes." -ForegroundColor White
    }
    
    Write-Host "`nSmart sampling saves you $timeSavedMinutes minutes and `$$([Math]::Round($costSaved, 2))!" -ForegroundColor Green
    
    # Close connection
    $connection.Close()
    Write-Host "`nDatabase connection closed" -ForegroundColor Gray
    
} catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
    exit 1
}
