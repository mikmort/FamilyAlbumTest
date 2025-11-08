# Face Recognition Setup - Summary

## ✅ What's Complete

### 1. Azure Resources Created
- ✅ **Python Function App**: `familyalbum-faces-api.azurewebsites.net`
  - Runtime: Python 3.10, Linux, Consumption Plan
  - Application Insights enabled
  - CORS configured for Static Web App

### 2. Code Structure
- ✅ **`/api-python`** - Python Azure Function App with 3 functions:
  - `detect-faces` - AI face detection and matching
  - `faces-train` - Regenerate person face profiles
  - `faces-review` - Get/confirm/reject face suggestions
  
- ✅ **`/api/shared/pythonFunctionClient.js`** - Node.js client for Python API
- ✅ **`/api/uploadComplete/index.js`** - Updated to call Python face detection
- ✅ **`/database/face-encodings-schema.sql`** - Database tables created
- ✅ **`/components/MediaDetailModal.tsx`** - UI for face suggestions
- ✅ **`/components/FaceReview.tsx`** - Batch review interface

### 3. Database
- ✅ Tables: `FaceEncodings`, `PersonEncodings`
- ✅ Stored procedures: `sp_ConfirmFaceMatch`, `sp_RejectFaceMatch`, `sp_GetFacesForReview`
- ✅ View: `vw_FaceDetectionStats`

### 4. Configuration
- ✅ Function App Settings:
  - `AZURE_SQL_CONNECTIONSTRING`
  - `AZURE_STORAGE_CONNECTION_STRING`
  - `BLOB_CONTAINER_NAME`
  - `ALLOWED_ORIGINS`
  - CORS: Static Web App URL

## ⏳ Manual Steps Required

### Step 1: Deploy Python Functions (10-15 minutes)

The Python functions need to be deployed to Azure. This requires dlib compilation which takes time.

**Option A: Azure Portal (Easiest)**
1. Open https://portal.azure.com
2. Go to Resource Groups → `familyalbum-prod-rg` → `familyalbum-faces-api`
3. Click "Deployment Center" in left menu
4. Choose "Local Git" or "FTPS credentials"
5. Upload `api-python/deploy.zip` 
6. Wait for remote build (will see "Building..." in logs)
7. Check "Functions" tab to see deployed functions

**Option B: PowerShell Script**
```powershell
.\scripts\deploy-python-functions.ps1
```

**Option C: Azure CLI**
```powershell
cd api-python
az functionapp deployment source config-zip `
  --resource-group familyalbum-prod-rg `
  --name familyalbum-faces-api `
  --src deploy.zip `
  --build-remote true `
  --timeout 900
```

### Step 2: Add Environment Variable to Static Web App

The Node.js API needs to know where the Python Function App is located.

```powershell
# Add to Static Web App configuration
az staticwebapp appsettings set `
  --name familyalbum-prod-app `
  --resource-group familyalbum-prod-rg `
  --setting-names PYTHON_FUNCTION_APP_URL=https://familyalbum-faces-api.azurewebsites.net
```

Or via Azure Portal:
1. Go to Static Web App: `familyalbum-prod-app`
2. Click "Configuration" → "Application settings"
3. Add new setting:
   - Name: `PYTHON_FUNCTION_APP_URL`
   - Value: `https://familyalbum-faces-api.azurewebsites.net`

### Step 3: Test Face Detection

After deployment:

1. **Upload a photo with faces** via the app
2. **Check MediaDetailModal** - Should show yellow banner with face suggestions
3. **Visit /face-review** - Should show pending faces to review
4. **Confirm or reject** - Test the workflow

## 📊 How It Works

```
┌─────────────────┐
│   User uploads  │
│   photo         │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  uploadComplete │ (Node.js)
│  /api           │ Saves to DB
└────────┬────────┘ Triggers face detection
         │
         │ HTTP POST
         ▼
┌─────────────────┐
│  detect-faces   │ (Python)
│  familyalbum-   │ - Downloads image
│  faces-api      │ - Detects faces
└────────┬────────┘ - Matches known people
         │          - Saves to FaceEncodings
         │
         ▼
┌─────────────────┐
│  FaceEncodings  │
│  table          │ Stores suggestions
└────────┬────────┘
         │
         │ User reviews
         ▼
┌─────────────────┐
│  MediaDetail    │ Shows suggestions
│  Modal          │ User confirms/rejects
└─────────────────┘
```

## 🧪 Testing Checklist

- [ ] Python functions deployed successfully
- [ ] Functions appear in Azure Portal
- [ ] Environment variable added to Static Web App
- [ ] Upload photo with recognizable faces
- [ ] Face detection runs (check browser console)
- [ ] Suggestions appear in MediaDetailModal
- [ ] Can confirm a face suggestion
- [ ] Can reject a face suggestion
- [ ] /face-review page loads
- [ ] Batch review works

## 💰 Cost Impact

- **Python Function App**: ~$0/month (Consumption plan, free tier)
- **Application Insights**: ~$0-5/month (low usage)
- **Additional storage**: Minimal (face embeddings are small)

## 📚 Documentation

- **`docs/FACE_RECOGNITION.md`** - Feature overview
- **`docs/PYTHON_FUNCTION_DEPLOYMENT.md`** - Deployment guide
- **`api-python/README.md`** - Python functions README
- **`database/face-encodings-schema.sql`** - Database schema

## 🔍 Troubleshooting

### Functions not deploying?
- Check timeout settings (dlib takes 10-15 min to compile)
- Verify `requirements.txt` exists in `api-python/`
- Check deployment logs in Azure Portal

### Face detection not triggering?
- Verify `PYTHON_FUNCTION_APP_URL` is set in Static Web App
- Check browser console for errors
- Review Application Insights logs

### No face suggestions showing?
- Upload photo with clear, frontal faces
- Check FaceEncodings table has records
- Verify database connection string is correct

## 🚀 Next Steps

1. Complete Python function deployment (Step 1 above)
2. Add environment variable (Step 2 above)
3. Test with real photos (Step 3 above)
4. Tag a few photos manually to build training data
5. Run `faces-train` to generate person profiles
6. Upload more photos to see auto-suggestions

## 📞 Need Help?

- Check logs: Azure Portal → Function App → Log stream
- Review Application Insights for errors
- Check database: Query FaceEncodings and PersonEncodings tables
- Test endpoints directly with Postman or curl
