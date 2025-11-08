# Face API Implementation - Deployment Blocker

## Status: 95% Complete!

### ✅ What's Done:
1. Azure Face API resource created and configured
2. All Python code updated to use Face API (no more dlib!)
3. requirements.txt updated (removed CMake/dlib dependencies)
4. Shared utilities created (face_client.py, get_blob_with_sas)
5. All code committed to git

### ❌ Current Blocker:
The Function App (`familyalbum-faces-api`) is stuck in Docker container mode and won't accept Python deployment.

**Issue:** `linuxFxVersion` is set to `DOCKER|familyalbumregistry.azurecr.io/faces-api:latest`
**Need:** Change to `Python|3.10`
**Problem:** PowerShell is interpreting the pipe character incorrectly

---

## Solution Options

### Option 1: Use Azure Portal (Easiest - 2 minutes)

1. Go to Azure Portal: https://portal.azure.com
2. Navigate to: **Resource Groups** → **familyalbum-prod-rg** → **familyalbum-faces-api**
3. In the left menu, click **Configuration**
4. Under **General settings** tab, find **Stack**
5. Change:
   - **Stack**: Python
   - **Python Version**: 3.10
6. Click **Save** at the top
7. Wait for restart (30 seconds)
8. Then deploy:
   ```powershell
   cd api-python
   func azure functionapp publish familyalbum-faces-api --python
   ```

### Option 2: Use Azure Cloud Shell (Bash doesn't have pipe escaping issue)

1. Open https://shell.azure.com (choose Bash)
2. Run:
   ```bash
   az resource update \
     --ids "/subscriptions/8cf05593-3360-4741-b3e8-ccc6f4f61290/resourceGroups/familyalbum-prod-rg/providers/Microsoft.Web/sites/familyalbum-faces-api" \
     --set properties.siteConfig.linuxFxVersion="Python|3.10"
   
   az functionapp restart \
     --name familyalbum-faces-api \
     --resource-group familyalbum-prod-rg
   ```
3. Wait 30 seconds, then deploy from local PowerShell:
   ```powershell
   cd api-python
   func azure functionapp publish familyalbum-faces-api --python
   ```

### Option 3: Recreate Function App (Nuclear option - 10 minutes)

Only if the above don't work:

```powershell
# Delete current Function App
az functionapp delete --name familyalbum-faces-api --resource-group familyalbum-prod-rg

# Recreate with Python runtime
az functionapp create `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  --consumption-plan-location eastus2 `
  --runtime python `
  --runtime-version 3.10 `
  --functions-version 4 `
  --os-type Linux `
  --storage-account famprodgajerhxssqswm

# Re-add all environment variables (see FACE_API_IMPLEMENTATION_SUMMARY.md for full list)
```

---

## After Deployment Succeeds

### 1. Run Database Migration

The AzureFacePersons table needs to be created. **Easiest way:**

1. Go to Azure Portal
2. Navigate to: **SQL databases** → **FamilyAlbum** → **Query editor**
3. Sign in
4. Paste this SQL:
   ```sql
   IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AzureFacePersons')
   BEGIN
       CREATE TABLE AzureFacePersons (
           PersonID INT NOT NULL,
           AzurePersonID NVARCHAR(36) NOT NULL,
           PersonGroupID NVARCHAR(50) NOT NULL DEFAULT 'family-album',
           CreatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
           UpdatedDate DATETIME2 NOT NULL DEFAULT GETDATE(),
           PRIMARY KEY (PersonID, PersonGroupID),
           FOREIGN KEY (PersonID) REFERENCES NameEvent(ID) ON DELETE CASCADE
       );
       CREATE INDEX IX_AzureFacePersons_AzurePersonID ON AzureFacePersons(AzurePersonID);
       SELECT 'Created AzureFacePersons table' as Result;
   END
   ```
5. Click **Run**

### 2. Test the Deployment

**From PowerShell:**
```powershell
# Test seed function
Invoke-WebRequest `
  -Uri "https://familyalbum-faces-api.azurewebsites.net/api/faces/seed" `
  -Method POST `
  -Body '{"limit": 5, "maxPerPerson": 5}' `
  -ContentType "application/json"

# Test train function
Invoke-WebRequest `
  -Uri "https://familyalbum-faces-api.azurewebsites.net/api/faces/train" `
  -Method POST `
  -ContentType "application/json"
```

**From your app:**
1. Go to **Admin Settings**
2. Click **"Train Now"** button
3. Should see: *"Processing tagged photos (up to 5 per person)..."*
4. Wait for completion
5. Click **"Train Now"** again
6. Should see: *"Processing any new manually-tagged photos..."*

### 3. Verify It Works

Check Function App logs:
```powershell
az webapp log tail --name familyalbum-faces-api --resource-group familyalbum-prod-rg
```

Look for:
- ✅ "Face seeding (Azure Face API) starting"
- ✅ "PersonGroup 'family-album' ready"
- ✅ "Added X faces from Y photos"
- ✅ "Training completed successfully"

---

## What Changed (Reminder)

### Before (dlib):
- Required CMake to compile
- Needed Premium plan for Docker ($150/month)
- Complex deployment issues

### After (Face API):
- No compilation needed
- Works on Consumption plan (free tier)
- Simple deployment
- Better face recognition (professional ML service)

---

## Files Changed

**Modified:**
- `api-python/faces-seed/__init__.py` - Now uses Face API (158 lines vs 260)
- `api-python/faces-train/__init__.py` - Now uses Face API (79 lines vs 278)
- `api-python/requirements.txt` - Removed dlib/CMake, added Face API SDK
- `api-python/shared_python/utils.py` - Added `get_blob_with_sas()` function

**Created:**
- `api-python/shared_python/face_client.py` - Face API utilities
- `database/add-azure-face-persons.sql` - Database schema
- Comprehensive documentation (3 markdown files)

**Committed:** ✅ Commit `81ff17a` - "Migrate face recognition from dlib to Azure Face API"

---

## Next Steps (Choose Option 1)

1. **Fix Function App runtime** using Azure Portal (Option 1 above)
2. **Deploy functions**: `func azure functionapp publish familyalbum-faces-api --python`
3. **Run database migration** via Azure Portal Query Editor
4. **Test from Admin Settings** → Train Now button

**Time estimate:** 10 minutes total

---

## Need Help?

- **Technical details**: `docs/FACE_API_MIGRATION.md`
- **Quick reference**: `docs/FACE_API_QUICK_START.md`  
- **Complete summary**: `FACE_API_IMPLEMENTATION_SUMMARY.md`

The code is ready - just need to fix the deployment blocker! 🚀
