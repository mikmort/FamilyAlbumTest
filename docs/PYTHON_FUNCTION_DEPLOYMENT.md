# Python Function App Deployment Status

## Status: Partially Complete

### ✅ Completed
1. Python Function App created: `familyalbum-faces-api`
2. App Settings configured:
   - AZURE_SQL_CONNECTIONSTRING
   - AZURE_STORAGE_CONNECTION_STRING  
   - BLOB_CONTAINER_NAME
   - ALLOWED_ORIGINS
3. CORS configured for Static Web App
4. Function code prepared in `/api-python` directory

### ⏳ In Progress
- Deploying Python functions with dependencies (dlib compilation takes ~10-15 minutes)

### 📋 Next Steps

#### 1. Complete Python Function Deployment

**Option A: Using Azure Portal (Recommended for first deployment)**
1. Open https://portal.azure.com
2. Navigate to `familyalbum-faces-api` Function App
3. Go to "Deployment Center"
4. Choose "Local Git" or "ZIP Deploy"
5. Upload the `api-python/deploy.zip` file
6. Wait for remote build to complete (includes dlib compilation)

**Option B: Using PowerShell Script**
```powershell
.\scripts\deploy-python-functions.ps1
```

**Option C: Using Azure CLI (manual)**
```powershell
cd api-python
az webapp deployment source config-zip `
  --resource-group familyalbum-prod-rg `
  --name familyalbum-faces-api `
  --src deploy.zip `
  --timeout 900
```

#### 2. Verify Functions Deployed

After deployment completes, verify the functions:

```powershell
az functionapp function list `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  --query "[].name" -o table
```

Expected output:
- detect-faces
- faces-train
- faces-review

#### 3. Get Function URLs

```powershell
az functionapp function show `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  --function-name detect-faces `
  --query "invokeUrlTemplate"
```

Base URL will be: `https://familyalbum-faces-api.azurewebsites.net/api/`

## Integration with Node.js API

Once Python functions are deployed, the Node.js API needs to be updated to call them.

### Files to Update:

1. **`/api/uploadComplete/index.js`** - Call detect-faces after upload
2. **`/api/media/index.js`** - Proxy /faces endpoint to Python Function App
3. Create **`/api/shared/pythonFunctionClient.js`** - HTTP client for Python functions

### Environment Variable Needed:

Add to Azure Static Web App settings:
```
PYTHON_FUNCTION_APP_URL=https://familyalbum-faces-api.azurewebsites.net
```

## Testing

### Test detect-faces endpoint:
```powershell
$headers = @{"Content-Type"="application/json"}
$body = @{
    filename = "test-photo.jpg"
    autoConfirm = $true
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri "https://familyalbum-faces-api.azurewebsites.net/api/detect-faces" `
  -Method POST `
  -Headers $headers `
  -Body $body
```

### Test faces-review endpoint:
```powershell
Invoke-RestMethod `
  -Uri "https://familyalbum-faces-api.azurewebsites.net/api/faces/review?limit=10" `
  -Method GET
```

## Architecture

```
┌─────────────────┐
│  Static Web App │ (Next.js Frontend)
│  (port 3000)    │
└────────┬────────┘
         │
         │ API calls
         ▼
┌─────────────────┐
│   Node.js API   │ (Azure Functions - JavaScript)
│   /api/*        │ - uploadComplete
└────────┬────────┘ - media
         │          - people
         │          - events
         │
         │ HTTP calls to Python endpoints
         ▼
┌─────────────────┐
│   Python API    │ (Azure Function App - Python)
│   /api/*        │ - detect-faces
└─────────────────┘ - faces-train
                    - faces-review
```

## Costs

- **Python Function App**: Consumption plan (~$0/month for low usage)
- **Application Insights**: Included, minimal cost for telemetry
- **dlib compilation**: Only happens once during deployment

## Troubleshooting

### If deployment times out:
- Increase timeout: `--timeout 900` (15 minutes)
- Check deployment logs in Azure Portal
- dlib compilation is CPU-intensive and takes time

### If functions don't appear:
- Check that `host.json` exists in api-python
- Verify `function.json` exists in each function folder
- Check Application Insights for errors

### If functions return errors:
- Check environment variables are set correctly
- Verify database connection string has correct password
- Check storage account key is valid
- Review logs in Azure Portal → Function App → Log stream
