# Python Azure Function App - Face Recognition

This directory contains Python Azure Functions for face detection and recognition features.

## Functions

- **detect-faces**: Detects faces in uploaded images and suggests matches
- **faces-train**: Regenerates person face profiles from confirmed tags
- **faces-review**: Get and manage face recognition suggestions

## Local Development

1. Install Azure Functions Core Tools (v4):
```powershell
npm install -g azure-functions-core-tools@4
```

2. Create a virtual environment:
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Install dependencies:
```powershell
pip install -r requirements.txt
```

4. Copy `.env.local` from root and update `local.settings.json` with connection strings

5. Run locally:
```powershell
func start
```

## Deployment

### Option 1: Using Azure CLI

```powershell
# Create Function App
az functionapp create `
  --resource-group familyalbum-prod-rg `
  --consumption-plan-location eastus `
  --runtime python `
  --runtime-version 3.10 `
  --functions-version 4 `
  --name familyalbum-faces-api `
  --storage-account famprodgajerhxssqswm

# Deploy
func azure functionapp publish familyalbum-faces-api
```

### Option 2: Using VS Code

1. Install "Azure Functions" extension
2. Right-click on `api-python` folder
3. Select "Deploy to Function App..."
4. Follow prompts to create/select Function App

## Environment Variables

The following must be configured in Azure Function App settings:

- `AZURE_SQL_CONNECTIONSTRING`: Database connection string
- `AZURE_STORAGE_CONNECTION_STRING`: Blob storage connection string
- `BLOB_CONTAINER_NAME`: Container name (family-album-media)
- `ALLOWED_ORIGINS`: CORS origins (e.g., https://your-site.azurestaticapps.net)

## Integration

The main Node.js API (in `/api`) will call these Python functions via HTTP:
- From `uploadComplete`: POST to detect-faces endpoint
- From `media`: GET from faces endpoints
- From UI: POST to faces-review endpoint
