# Test Face Training Diagnostic Endpoint
# This script tests both the original and debug endpoints

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Face Training Diagnostic Test" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:7071/api"  # Azure Functions default port
$altBaseUrl = "http://localhost:3000/api"  # Next.js API route

# Try to determine which URL to use
Write-Host "Testing connectivity..." -ForegroundColor Yellow

$functionsRunning = $false
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/auth-status" -Method GET -TimeoutSec 2 -ErrorAction Stop
    $functionsRunning = $true
    Write-Host "✓ Azure Functions detected at $baseUrl" -ForegroundColor Green
} catch {
    Write-Host "✗ Azure Functions not responding at $baseUrl" -ForegroundColor Red
    Write-Host "  Trying Next.js API routes at $altBaseUrl..." -ForegroundColor Yellow
    $baseUrl = $altBaseUrl
}

Write-Host ""
Write-Host "Using base URL: $baseUrl" -ForegroundColor Cyan
Write-Host ""

# Test 1: Auth Status
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Test 1: Auth Status Check" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/auth-status" -Method GET
    Write-Host "Status: SUCCESS" -ForegroundColor Green
    Write-Host "Authenticated: $($response.authenticated)" -ForegroundColor White
    Write-Host "Authorized: $($response.authorized)" -ForegroundColor White
    Write-Host "User: $($response.user.email) ($($response.user.role))" -ForegroundColor White
    if ($response.databaseWarming) {
        Write-Host "⚠️  Database is warming up!" -ForegroundColor Yellow
    }
} catch {
    Write-Host "Status: FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
    }
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 2: Original Endpoint (will likely fail)
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Test 2: Original Tagged Photos Endpoint" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/faces-tagged-photos?smartSample=true" -Method GET
    Write-Host "Status: SUCCESS ✓" -ForegroundColor Green
    Write-Host "Photos returned: $($response.photos.Count)" -ForegroundColor White
    if ($response.samplingStats) {
        Write-Host "People with photos: $($response.samplingStats.PSObject.Properties.Count)" -ForegroundColor White
    }
} catch {
    Write-Host "Status: FAILED ✗" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
        
        # Try to get response body
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            Write-Host "Response Body:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor White
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Red
        }
    }
}

Write-Host ""
Start-Sleep -Seconds 1

# Test 3: Debug Endpoint (detailed diagnostics)
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Test 3: Debug Endpoint (Detailed Diagnostics)" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/faces-tagged-photos-debug" -Method GET
    Write-Host "Status: SUCCESS ✓" -ForegroundColor Green
    Write-Host ""
    
    if ($response.summary) {
        Write-Host "SUMMARY:" -ForegroundColor Yellow
        Write-Host "  People in database: $($response.summary.peopleInDatabase)" -ForegroundColor White
        Write-Host "  Total tagged pairs: $($response.summary.totalTaggedPairs)" -ForegroundColor White
        Write-Host "  Persons with photos: $($response.summary.personsWithPhotos)" -ForegroundColor White
        Write-Host "  Sample photos returned: $($response.summary.samplePhotosReturned)" -ForegroundColor White
        Write-Host "  SAS URL generated: $($response.summary.sasUrlGenerated)" -ForegroundColor White
        if ($response.summary.sasError) {
            Write-Host "  SAS Error: $($response.summary.sasError)" -ForegroundColor Red
        }
        Write-Host ""
    }
    
    if ($response.debugLog) {
        Write-Host "DEBUG LOG:" -ForegroundColor Yellow
        foreach ($entry in $response.debugLog) {
            $color = "White"
            if ($entry.step -like "*ERROR*" -or $entry.step -like "*FAILED*") {
                $color = "Red"
            } elseif ($entry.step -like "*COMPLETE*" -or $entry.step -like "*SUCCESS*") {
                $color = "Green"
            }
            
            Write-Host "  [$($entry.step)]" -ForegroundColor $color -NoNewline
            Write-Host " @ $($entry.timestamp)" -ForegroundColor Gray
            
            # Show relevant data
            if ($entry.data -and ($entry.data.PSObject.Properties.Count -gt 0)) {
                $dataJson = $entry.data | ConvertTo-Json -Compress -Depth 3
                if ($dataJson.Length -gt 200) {
                    $dataJson = $dataJson.Substring(0, 200) + "..."
                }
                Write-Host "    $dataJson" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    Write-Host "Full response saved to: debug-response.json" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Out-File "debug-response.json" -Encoding UTF8
    
} catch {
    Write-Host "Status: FAILED ✗" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "HTTP Status: $statusCode" -ForegroundColor Red
        
        # Try to get response body
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            $reader.Close()
            Write-Host "Response Body:" -ForegroundColor Yellow
            Write-Host $responseBody -ForegroundColor White
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review the debug log above to find where it fails" -ForegroundColor White
Write-Host "2. Check debug-response.json for full details" -ForegroundColor White
Write-Host "3. If database is warming up, wait and try again" -ForegroundColor White
Write-Host "4. Share the debug log to get help with the specific error" -ForegroundColor White
Write-Host ""
