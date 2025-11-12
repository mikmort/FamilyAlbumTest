# Face Training 404 Error - Fixed

## Problem

When doing face training with InsightFace model, the training failed with "no faces could be processed" and hundreds of 404 errors in the console:

```
/api/generate-embeddings:1  Failed to load resource: the server responded with a status of 404 ()
```

## Root Cause

The `generate-embeddings` endpoint is a **Python Azure Function** (in `api-python/generate-embeddings`), not a Node.js function. The 404 errors occurred because:

1. The client calls `/api/generate-embeddings`
2. This routes to the Node.js API (port 7071)
3. No endpoint exists in the Node.js API for this path
4. The Python API runs separately on port 7072 (locally) or as a separate Azure Function App (production)

## Solution

Created a **proxy endpoint** in the Node.js API that forwards requests to the Python Function App.

### Files Created

1. **`api/generate-embeddings/function.json`** - Function binding configuration
2. **`api/generate-embeddings/index.js`** - Proxy endpoint that forwards to Python API

### How It Works

```
Client Browser
    ↓
    POST /api/generate-embeddings
    ↓
Node.js API (port 7071) - Proxy endpoint
    ↓
    Forwards to Python API
    ↓
Python API (port 7072 or Azure Function App)
    ↓
    Returns 512-dim InsightFace embedding
    ↓
Node.js API forwards response
    ↓
Client Browser
```

### Configuration Required

#### Local Development

1. **Start Python API first** (in separate terminal):
   ```powershell
   cd api-python
   func start
   ```
   This starts the Python API on port 7072.

2. **Configure Node.js API** to point to Python API:
   
   In `api/local.settings.json`, add:
   ```json
   {
     "Values": {
       "PYTHON_FUNCTION_APP_URL": "http://localhost:7072"
     }
   }
   ```

3. **Start Node.js API** (in another terminal):
   ```powershell
   cd api
   func start
   ```
   This starts the Node.js API on port 7071.

4. **Start Next.js** (in another terminal):
   ```powershell
   npm run dev
   ```

#### Production (Azure)

In your Azure Static Web App configuration, add application setting:
```
PYTHON_FUNCTION_APP_URL = https://familyalbum-faces-api.azurewebsites.net
```

This points to your deployed Python Function App.

## Testing the Fix

### 1. Verify Python API is Running

```powershell
# Test Python API directly
curl http://localhost:7072/api/generate-embeddings -Method POST -ContentType "application/json" -Body '{"imageUrl":"https://..."}'
```

### 2. Test Through Proxy

```powershell
# Test through Node.js proxy
curl http://localhost:7071/api/generate-embeddings -Method POST -ContentType "application/json" -Body '{"imageUrl":"https://..."}'
```

### 3. Test Face Training

1. Open the app at `http://localhost:3000`
2. Navigate to Settings > Face Recognition
3. Select "InsightFace (Python API)" as the model
4. Click "Start Training"
5. Should now work without 404 errors!

## Troubleshooting

### Still Getting 404 Errors?

**Check Python API is running:**
```powershell
# Should return Python API endpoints
curl http://localhost:7072/api/version
```

**Check Node.js API configuration:**
```powershell
# Verify PYTHON_FUNCTION_APP_URL is set
Get-Content api/local.settings.json | Select-String "PYTHON_FUNCTION_APP_URL"
```

**Check proxy endpoint exists:**
```powershell
# Should list generate-embeddings folder
ls api/generate-embeddings/
```

### Connection Refused Error?

This means the Python API isn't running. Start it:
```powershell
cd api-python
func start
```

Wait for it to show:
```
Functions:
  generate-embeddings: [POST] http://localhost:7072/api/generate-embeddings
```

### "No suitable face found" Errors?

This is expected for some photos - it means InsightFace couldn't detect a face or found too many faces. The training process will continue with other photos.

## Architecture Overview

The Family Album app uses a **hybrid architecture**:

- **Node.js API** (`/api`): Main API for database, storage, authentication
- **Python API** (`/api-python`): Face recognition using InsightFace AI models

The proxy endpoint bridges these two systems, allowing the client to call Python functions through the Node.js API.

## Related Files

- `api/generate-embeddings/index.js` - Proxy endpoint (NEW)
- `api/generate-embeddings/function.json` - Function configuration (NEW)
- `api-python/generate-embeddings/__init__.py` - Python implementation
- `components/AdminSettings.tsx` - Face training UI (calls the endpoint)
- `api/local.settings.json.template` - Updated with PYTHON_FUNCTION_APP_URL

## Next Steps

1. **Update your `api/local.settings.json`** to include `PYTHON_FUNCTION_APP_URL`
2. **Start the Python API** before testing face training
3. **Test face training** with InsightFace model
4. **Deploy** the proxy endpoint to production (already included in `/api`)
