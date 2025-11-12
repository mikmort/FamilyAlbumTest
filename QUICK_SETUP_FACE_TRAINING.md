# Quick Setup Guide - Face Training Fix

## What Was Fixed

Created a proxy endpoint (`api/generate-embeddings`) that bridges the Node.js API to the Python API for InsightFace face recognition.

## Setup Steps

### 1. Check Configuration

Run the configuration checker:

```powershell
npm run check:python-api
```

This will verify:
- ✅ Proxy endpoint exists
- ✅ PYTHON_FUNCTION_APP_URL is configured
- ✅ Python API files exist
- ✅ Both APIs are running (if started)

### 2. Update Configuration

If `api/local.settings.json` doesn't have `PYTHON_FUNCTION_APP_URL`, add it:

```json
{
  "Values": {
    "PYTHON_FUNCTION_APP_URL": "http://localhost:7072",
    ... other settings ...
  }
}
```

Or regenerate the file:

```powershell
npm run setup:api-env
```

### 3. Start the Python API

Open a new terminal and run:

```powershell
cd api-python
func start
```

Wait for it to show:

```
Functions:
  generate-embeddings: [POST] http://localhost:7072/api/generate-embeddings
  ...
```

### 4. Start the Node.js API

Open another terminal and run:

```powershell
cd api
func start
```

Wait for it to show:

```
Functions:
  generate-embeddings: [POST] http://localhost:7071/api/generate-embeddings
  ...
```

### 5. Start Next.js

Open another terminal and run:

```powershell
npm run dev
```

### 6. Test Face Training

1. Navigate to http://localhost:3000
2. Go to Settings → Face Recognition
3. Select "InsightFace (Python API)"
4. Click "Start Training"
5. Should work without 404 errors! ✅

## Troubleshooting

### "404 Not Found" errors persist

- Verify Python API is running on port 7072
- Verify Node.js API is running on port 7071
- Run `npm run check:python-api` to diagnose

### "Connection refused" error

Python API is not running. Start it:

```powershell
cd api-python
func start
```

### Python API won't start

Install Python dependencies:

```powershell
cd api-python
pip install -r requirements.txt
```

### Node.js API won't start

Install Node.js dependencies:

```powershell
cd api
npm install
```

## Architecture

```
Browser (localhost:3000)
    ↓
Next.js Dev Server
    ↓
    POST /api/generate-embeddings
    ↓
Node.js API (localhost:7071)
    ↓
    Proxy forwards to Python API
    ↓
Python API (localhost:7072)
    ↓
    InsightFace generates 512-dim embedding
    ↓
    Returns to Node.js API
    ↓
    Returns to Browser
```

## Production Deployment

The proxy endpoint is ready for production. Just ensure your Azure Static Web App has:

```
Application Settings:
  PYTHON_FUNCTION_APP_URL = https://familyalbum-faces-api.azurewebsites.net
```

This points to your deployed Python Function App.

## Need Help?

Check these files for more details:
- `FACE_TRAINING_404_FIX.md` - Complete problem analysis and solution
- `docs/LOCAL_AZURE_FUNCTIONS.md` - Local development guide
- `api-python/README.md` - Python API documentation
