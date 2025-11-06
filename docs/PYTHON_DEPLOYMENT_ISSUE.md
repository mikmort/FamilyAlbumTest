# Python Functions Deployment Issue - dlib/CMake

## Problem

The face recognition Python functions (`faces-seed` and `faces-train`) cannot be deployed to Azure Functions using standard deployment because `dlib` requires CMake to compile, which is not available in the Azure Oryx build environment.

## Workaround Options

### Option 1: Deploy Node.js Changes Only (RECOMMENDED FOR NOW)

The incremental training UI changes in `AdminSettings.tsx` and the new `/api/faces/check-training-status` endpoint can be deployed without the Python functions. The Python functions are already deployed from a previous version that works.

**What's already deployed and working:**
- `/api/faces/train` - Python function (old version without quickTrain)
- `/api/faces/seed` - Python function (old version without maxPerPerson)

**What needs deploying:**
- `components/AdminSettings.tsx` - UI with cancel button and phase detection ✅
- `/api/faces/check-training-status` - New Node.js endpoint ✅  
- Node.js API proxies (already forward all parameters) ✅

**Deploy Node.js/Frontend only:**
```powershell
# This will deploy the Static Web App including the new UI and API
# It will NOT affect the Python functions
swa deploy
```

**Result:** You'll get:
- ✅ Cancel button in UI
- ✅ Training status checking
- ⚠️ quickTrain and maxPerPerson parameters will be passed to Python functions but ignored (they'll use existing logic)

**To get full incremental training later**, we need to solve the Python deployment issue.

---

### Option 2: Use Docker Container Deployment

Deploy Python functions as a Docker container which can include CMake.

**Steps:**

1. Create `Dockerfile` in `api-python`:
```dockerfile
FROM mcr.microsoft.com/azure-functions/python:4-python3.10

# Install system dependencies for dlib
RUN apt-get update && \
    apt-get install -y cmake build-essential && \
    rm -rf /var/lib/apt/lists/*

# Copy function app
COPY . /home/site/wwwroot

# Install Python dependencies
WORKDIR /home/site/wwwroot
RUN pip install --no-cache-dir -r requirements.txt

# Set environment
ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true
```

2. Build and push Docker image:
```powershell
az acr create --resource-group familyalbum-prod-rg --name familyalbumacr --sku Basic
az acr login --name familyalbumacr
docker build -t familyalbumacr.azurecr.io/faces-api:latest ./api-python
docker push familyalbumacr.azurecr.io/faces-api:latest
```

3. Update Function App to use container:
```powershell
az functionapp config container set `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  --docker-custom-image-name familyalbumacr.azurecr.io/faces-api:latest `
  --docker-registry-server-url https://familyalbumacr.azurecr.io
```

**Pros:** Full control, CMake available
**Cons:** More complex, requires Azure Container Registry

---

### Option 3: Pre-compile dlib Wheel Locally

Build dlib wheel on a Linux machine with CMake, then include it in deployment.

**Steps:**

1. On a Linux machine (or WSL2):
```bash
# Install CMake
sudo apt-get install cmake build-essential

# Build dlib wheel
pip wheel dlib==19.24.6

# This creates: dlib-19.24.6-cp310-cp310-linux_x86_64.whl
```

2. Upload wheel to Azure Blob Storage or include in repo

3. Modify `requirements.txt`:
```
azure-functions>=1.11.0
numpy<2.0.0,>=1.21.0
Pillow>=9.0.0
azure-storage-blob>=12.14.0
pyodbc>=4.0.35
werkzeug~=3.1.3

# Use pre-built wheel for dlib
https://yourstorage.blob.core.windows.net/wheels/dlib-19.24.6-cp310-cp310-linux_x86_64.whl

face-recognition>=1.3.0
```

**Pros:** Works with standard deployment
**Cons:** Requires Linux build machine, wheel must match Python version

---

### Option 4: Wait for Azure to Add CMake Support

Monitor Azure Functions runtime updates. CMake support may be added in future.

**Temporary workaround:** Keep using existing Python functions until deployment is resolved.

---

## Recommended Immediate Action

**Deploy the Node.js/Frontend changes NOW:**

```powershell
# From project root
git add .
git commit -m "Add incremental training UI with cancel button and status checking"
git push origin main

# Azure Static Web Apps will auto-deploy via GitHub Actions
# Or deploy manually:
swa deploy
```

This gives you:
- Cancel button working
- Training status API endpoint
- UI ready for incremental training

**Then address Python deployment separately** using Option 2 (Docker) which is the most reliable long-term solution.

---

## Current Status

✅ **Deployed and Working:**
- Original faces-train Python function
- Original faces-seed Python function  
- All Node.js API endpoints
- Frontend UI

⏳ **Ready to Deploy (Node.js/Frontend):**
- Updated AdminSettings.tsx with cancel button
- New /api/faces/check-training-status endpoint
- Parameter forwarding in API proxies

❌ **Blocked (Python Functions):**
- faces-seed with maxPerPerson support
- faces-train with quickTrain support
- Requires CMake for dlib compilation

## Testing Without Python Updates

You can still test the UI changes:
1. Cancel button will work (cancels between API calls)
2. Status checking will work (counts existing trained persons)
3. Incremental training logic will execute but Python will use old behavior

The UI is **forward compatible** - it will work perfectly once Python functions are updated.
