# Test Python Function App Endpoints
# This script tests the deployed face recognition functions

param(
    [string]$FunctionAppUrl = "https://familyalbum-faces-api.azurewebsites.net"
)

Write-Host "🧪 Testing Python Function App..." -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if Function App is responding
Write-Host "1️⃣  Testing Function App health..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri $FunctionAppUrl -Method Get -TimeoutSec 10 -ErrorAction Stop
    Write-Host "✅ Function App is responding (Status: $($response.StatusCode))" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Function App not responding: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   This is expected if functions are still deploying..." -ForegroundColor Yellow
}

Write-Host ""

# Test 2: List deployed functions using Azure CLI
Write-Host "2️⃣  Checking deployed functions..." -ForegroundColor Yellow
try {
    $functions = az functionapp function list `
        --name familyalbum-faces-api `
        --resource-group familyalbum-prod-rg `
        --query "[].{Name:name, TriggerType:config.bindings[0].type}" `
        -o json | ConvertFrom-Json
    
    if ($functions.Count -gt 0) {
        Write-Host "✅ Found $($functions.Count) function(s):" -ForegroundColor Green
        foreach ($func in $functions) {
            Write-Host "   - $($func.Name) ($($func.TriggerType))" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No functions found yet" -ForegroundColor Yellow
        Write-Host "   Functions may still be building (dlib compilation takes 10-15 min)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  Could not list functions: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Check function logs
Write-Host "3️⃣  Checking recent logs..." -ForegroundColor Yellow
try {
    Write-Host "   Opening log stream in browser..." -ForegroundColor Cyan
    Write-Host "   Azure Portal: https://portal.azure.com/#resource/subscriptions/8cf05593-3360-4741-b3e8-ccc6f4f61290/resourceGroups/familyalbum-prod-rg/providers/Microsoft.Web/sites/familyalbum-faces-api/logStream" -ForegroundColor White
} catch {
    Write-Host "⚠️  Could not access logs" -ForegroundColor Red
}

Write-Host ""

# Test 4: Test detect-faces endpoint (if deployed)
Write-Host "4️⃣  Testing detect-faces endpoint..." -ForegroundColor Yellow
$detectFacesUrl = "$FunctionAppUrl/api/detect-faces"

# Create test payload
$testPayload = @{
    filename = "media/test.jpg"
    autoConfirm = $false
} | ConvertTo-Json

try {
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri $detectFacesUrl -Method Post -Body $testPayload -Headers $headers -TimeoutSec 30 -ErrorAction Stop
    Write-Host "✅ detect-faces endpoint is working!" -ForegroundColor Green
    Write-Host "   Response: $($response | ConvertTo-Json -Depth 2)" -ForegroundColor White
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "⚠️  Endpoint not found (404) - functions still deploying" -ForegroundColor Yellow
    } elseif ($_.Exception.Response.StatusCode -eq 500) {
        Write-Host "⚠️  Endpoint exists but returned error (500)" -ForegroundColor Yellow
        Write-Host "   This might be expected without a real image file" -ForegroundColor Gray
    } else {
        Write-Host "⚠️  Could not test endpoint: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "📊 Configuration Status:" -ForegroundColor Cyan
Write-Host ""

# Check Static Web App configuration
Write-Host "🔧 Static Web App environment variables:" -ForegroundColor Yellow
try {
    $settings = az staticwebapp appsettings list `
        --name familyalbum-prod-app `
        --query "properties" `
        -o json | ConvertFrom-Json
    
    if ($settings.PYTHON_FUNCTION_APP_URL) {
        Write-Host "   ✅ PYTHON_FUNCTION_APP_URL is set" -ForegroundColor Green
    } else {
        Write-Host "   ❌ PYTHON_FUNCTION_APP_URL is NOT set" -ForegroundColor Red
    }
} catch {
    Write-Host "   ⚠️  Could not check Static Web App settings" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🔧 Function App settings:" -ForegroundColor Yellow
try {
    $appSettings = az functionapp config appsettings list `
        --name familyalbum-faces-api `
        --resource-group familyalbum-prod-rg `
        --query "[?name=='AZURE_SQL_CONNECTIONSTRING' || name=='AZURE_STORAGE_CONNECTION_STRING' || name=='BLOB_CONTAINER_NAME' || name=='FUNCTIONS_WORKER_RUNTIME']" `
        -o json | ConvertFrom-Json
    
    $requiredSettings = @(
        "AZURE_SQL_CONNECTIONSTRING",
        "AZURE_STORAGE_CONNECTION_STRING", 
        "BLOB_CONTAINER_NAME",
        "FUNCTIONS_WORKER_RUNTIME"
    )
    
    foreach ($required in $requiredSettings) {
        $setting = $appSettings | Where-Object { $_.name -eq $required }
        if ($setting -and $setting.value) {
            Write-Host "   ✅ $required" -ForegroundColor Green
        } else {
            Write-Host "   ❌ $required is missing" -ForegroundColor Red
        }
    }
} catch {
    Write-Host "   ⚠️  Could not check Function App settings" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Configuration test complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Next steps if functions aren't deployed yet:" -ForegroundColor Cyan
Write-Host "   1. Wait for deployment to complete (10-15 minutes)" -ForegroundColor White
Write-Host "   2. Monitor: https://portal.azure.com → familyalbum-faces-api → Deployment Center" -ForegroundColor White
Write-Host "   3. Run this script again to verify" -ForegroundColor White
Write-Host ""
