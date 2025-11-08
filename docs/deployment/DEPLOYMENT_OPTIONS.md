# Python Function Deployment - Step-by-Step Guide

## Current Situation

Your Python functions cannot deploy because `dlib` requires CMake to compile, which isn't available in Azure's standard build environment.

## ✅ What's Already Deployed

The following are working and deployed:
- Frontend UI with cancel button and incremental training logic
- Node.js API endpoints including `/api/faces/check-training-status`
- All parameter forwarding is configured

## 🔧 Deployment Options

### Option 1: Install Docker Desktop (Recommended - Most Complete)

**Time Required:** 30-60 minutes (including Docker install)

**Steps:**

1. **Install Docker Desktop:**
   - Download from: https://www.docker.com/products/docker-desktop/
   - Install and restart your computer if needed
   - Start Docker Desktop application

2. **Run the deployment script:**
   ```powershell
   .\scripts\deploy-python-docker.ps1
   ```

**What this does:**
- Creates Azure Container Registry (`familyalbumregistry`)
- Builds Docker image with CMake and all dependencies
- Pushes image to Azure
- Configures Function App to use the container
- Deploys working Python functions

**Pros:**
- ✅ Complete solution
- ✅ Easiest to maintain long-term
- ✅ Works every time

**Cons:**
- ❌ Requires Docker Desktop installation
- ❌ Docker Desktop can be resource-intensive

---

### Option 2: Use Azure Cloud Shell (No Local Install)

**Time Required:** 15-30 minutes

**Steps:**

1. **Open Azure Cloud Shell:**
   - Go to: https://portal.azure.com
   - Click the Cloud Shell icon (>_) in the top menu bar
   - Choose "Bash" environment

2. **Clone your repository:**
   ```bash
   git clone https://github.com/mikmort/FamilyAlbumTest.git
   cd FamilyAlbumTest
   ```

3. **Run deployment commands:**
   ```bash
   # Create Container Registry
   az acr create \
     --resource-group familyalbum-prod-rg \
     --name familyalbumregistry \
     --sku Basic \
     --admin-enabled true

   # Build and push image
   cd api-python
   az acr build \
     --registry familyalbumregistry \
     --image faces-api:latest \
     --file Dockerfile \
     .

   # Get credentials
   ACR_USERNAME=$(az acr credential show --name familyalbumregistry --query username -o tsv)
   ACR_PASSWORD=$(az acr credential show --name familyalbumregistry --query "passwords[0].value" -o tsv)

   # Configure Function App
   az functionapp config container set \
     --name familyalbum-faces-api \
     --resource-group familyalbum-prod-rg \
     --docker-custom-image-name familyalbumregistry.azurecr.io/faces-api:latest \
     --docker-registry-server-url https://familyalbumregistry.azurecr.io \
     --docker-registry-server-user $ACR_USERNAME \
     --docker-registry-server-password $ACR_PASSWORD

   # Restart Function App
   az functionapp restart \
     --name familyalbum-faces-api \
     --resource-group familyalbum-prod-rg
   ```

**Pros:**
- ✅ No local installation required
- ✅ Uses Azure's infrastructure
- ✅ Free to use

**Cons:**
- ❌ Requires internet connection
- ❌ Session timeout after 20 minutes of inactivity

---

### Option 3: Pre-compile dlib Wheel (Advanced)

**Time Required:** 30-45 minutes  
**Requirements:** Access to a Linux machine (or WSL2)

**Steps:**

1. **On Linux machine with CMake:**
   ```bash
   # Install dependencies
   sudo apt-get update
   sudo apt-get install -y cmake build-essential python3-pip

   # Build dlib wheel for Python 3.10
   pip3 wheel dlib==19.24.6 --no-deps

   # This creates: dlib-19.24.6-cp310-cp310-linux_x86_64.whl
   ```

2. **Upload wheel to Azure Blob Storage:**
   ```powershell
   az storage blob upload \
     --account-name famprodgajerhxssqswm \
     --container-name wheels \
     --name dlib-19.24.6-cp310-cp310-linux_x86_64.whl \
     --file dlib-19.24.6-cp310-cp310-linux_x86_64.whl
   ```

3. **Update requirements.txt:**
   ```
   azure-functions>=1.11.0
   numpy<2.0.0,>=1.21.0
   Pillow>=9.0.0
   azure-storage-blob>=12.14.0
   pyodbc>=4.0.35
   werkzeug~=3.1.3

   # Use pre-built wheel
   https://famprodgajerhxssqswm.blob.core.windows.net/wheels/dlib-19.24.6-cp310-cp310-linux_x86_64.whl

   face-recognition>=1.3.0
   ```

4. **Deploy normally:**
   ```powershell
   cd api-python
   func azure functionapp publish familyalbum-faces-api --python
   ```

**Pros:**
- ✅ No Docker required
- ✅ Standard deployment process

**Cons:**
- ❌ Requires Linux machine with CMake
- ❌ Wheel must match exact Python version (3.10)
- ❌ Must rebuild wheel for any dlib version changes

---

### Option 4: Live Without Python Functions (Temporary)

**Time Required:** 0 minutes (already done!)

Your app currently works without the Python functions. The UI changes are deployed and will work perfectly once Python functions are added later.

**What works now:**
- ✅ Cancel button shows and functions
- ✅ Training status checking
- ✅ UI shows correct messages
- ✅ Parameters are forwarded correctly

**What doesn't work:**
- ❌ No incremental training (5 photos first)
- ❌ No smart sampling yet
- ❌ Face recognition features pending

**To enable later:** Just come back and run Option 1 or 2 when convenient.

---

## 🎯 Recommended Path

**For immediate deployment:** **Option 2 (Azure Cloud Shell)**
- No installation required
- Works right now
- Takes 15-30 minutes

**For long-term solution:** **Option 1 (Docker Desktop)**
- Install Docker Desktop when convenient
- Best for future updates
- Most maintainable

---

## 📋 After Deployment

Once deployed successfully, verify:

1. **Check Function App:**
   ```powershell
   az functionapp list-functions \
     --name familyalbum-faces-api \
     --resource-group familyalbum-prod-rg \
     --query "[].{name:name}" -o table
   ```

2. **Test endpoints:**
   ```powershell
   # Check training status
   curl https://familyalbum-faces-api.azurewebsites.net/api/faces/check-training-status

   # Should return JSON instead of HTML welcome page
   ```

3. **Test from your app:**
   - Go to Admin Settings
   - Click "Train Now"
   - Should see baseline training message
   - Check for errors in browser console

---

## 🆘 Need Help?

If you encounter issues:
1. Check Azure Portal → Function App → Logs
2. Look for deployment errors
3. Verify container image was pushed successfully
4. Check that environment variables are set correctly

---

## Files Created for Docker Deployment

- `api-python/Dockerfile` - Container definition with CMake
- `api-python/.dockerignore` - Excludes unnecessary files
- `scripts/deploy-python-docker.ps1` - Automated deployment script

These files are ready to use whenever you choose Option 1!
