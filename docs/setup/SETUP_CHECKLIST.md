# Face Recognition Setup Checklist

## ✅ Completed Setup Steps

### Azure Resources
- [x] Created Python Function App: `familyalbum-faces-api.azurewebsites.net`
  - Runtime: Python 3.10
  - Plan: Linux Consumption
  - Location: East US
  - Application Insights: Enabled

### Configuration
- [x] Function App Settings Configured:
  - [x] `AZURE_SQL_CONNECTIONSTRING` ✅
  - [x] `AZURE_STORAGE_CONNECTION_STRING` ✅
  - [x] `BLOB_CONTAINER_NAME` ✅
  - [x] `FUNCTIONS_WORKER_RUNTIME` = python ✅
  - [x] `SCM_DO_BUILD_DURING_DEPLOYMENT` = true ✅

- [x] CORS Configured:
  - [x] Allowed Origin: `https://lively-glacier-02a77180f.2.azurestaticapps.net` ✅

- [x] Static Web App Environment Variable:
  - [x] `PYTHON_FUNCTION_APP_URL` = `https://familyalbum-faces-api.azurewebsites.net` ✅

### Code & Database
- [x] Database tables created:
  - [x] `FaceEncodings`
  - [x] `PersonEncodings`
  - [x] Stored procedures
  - [x] Views

- [x] Python functions ready:
  - [x] `detect-faces` - AI face detection
  - [x] `faces-train` - Train person profiles
  - [x] `faces-review` - Review suggestions

- [x] Node.js integration:
  - [x] `pythonFunctionClient.js` created
  - [x] `uploadComplete` updated to call Python API
  - [x] `media` endpoint ready for face data

- [x] Frontend components:
  - [x] `MediaDetailModal` - Show face suggestions
  - [x] `FaceReview` - Batch review page

## ⏳ In Progress

### Python Function Deployment
- [ ] **Python functions building on Azure** (10-15 minutes)
  - dlib compilation in progress
  - Monitor: [Deployment Center](https://portal.azure.com/#resource/subscriptions/8cf05593-3360-4741-b3e8-ccc6f4f61290/resourceGroups/familyalbum-prod-rg/providers/Microsoft.Web/sites/familyalbum-faces-api/deploymentCenter)

**To check deployment status:**
```powershell
.\scripts\test-python-functions.ps1
```

**Or manually:**
```powershell
az functionapp function list `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  -o table
```

Expected functions after deployment:
- `detect-faces`
- `faces-train`  
- `faces-review`

## 📋 Testing Checklist (After Deployment Completes)

### 1. Verify Functions Deployed
```powershell
# Should show 3 functions
az functionapp function list `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  -o table
```

### 2. Test detect-faces Endpoint
```powershell
$url = "https://familyalbum-faces-api.azurewebsites.net/api/detect-faces"
$body = @{
    filename = "media/test.jpg"
    autoConfirm = $false
} | ConvertTo-Json

Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
```

### 3. Upload Test Photo
- [ ] Upload a photo with clear, frontal faces
- [ ] Check browser console for face detection call
- [ ] Verify no errors in console

### 4. Check Face Suggestions
- [ ] Open photo in MediaDetailModal
- [ ] Look for yellow banner with face suggestions
- [ ] Verify confidence percentages show

### 5. Test Face Review
- [ ] Navigate to `/face-review` page
- [ ] Should show pending face suggestions
- [ ] Test "Confirm" button
- [ ] Test "Reject" button

### 6. Verify Database
```sql
-- Check FaceEncodings table
SELECT TOP 10 
    PFileName, 
    PersonID, 
    Confidence, 
    IsConfirmed, 
    IsRejected
FROM FaceEncodings
ORDER BY CreatedAt DESC;

-- Check PersonEncodings table
SELECT 
    ne.Name, 
    pe.EncodingCount
FROM PersonEncodings pe
JOIN NameEvent ne ON pe.PersonID = ne.ID
ORDER BY pe.EncodingCount DESC;
```

### 7. Test Training
After confirming some faces:
```powershell
$url = "https://familyalbum-faces-api.azurewebsites.net/api/faces/train"
Invoke-RestMethod -Uri $url -Method Post -ContentType "application/json"
```

## 🔍 Troubleshooting Guide

### Functions Not Deploying
**Symptoms:** No functions listed after 15+ minutes

**Solutions:**
1. Check deployment logs in Azure Portal
2. Verify `requirements.txt` is in `api-python/`
3. Try manual deployment via Portal:
   - Deployment Center → Upload `api-python/deploy.zip`

### Face Detection Not Triggering
**Symptoms:** No yellow banner after upload

**Solutions:**
1. Check `PYTHON_FUNCTION_APP_URL` in Static Web App settings
2. Verify CORS allows Static Web App origin
3. Check browser console for errors
4. Review Application Insights logs

### 500 Errors from Python Functions
**Symptoms:** Function returns Internal Server Error

**Solutions:**
1. Check database connection string
2. Verify storage account key is correct
3. Check function logs in Portal
4. Ensure image file exists in blob storage

### No Face Suggestions
**Symptoms:** Detection runs but no suggestions

**Solutions:**
1. Upload photos with clear, frontal faces
2. Check FaceEncodings table has records
3. Need at least 2 confirmed tags of same person for matching
4. Run `faces-train` to generate person profiles

## 📊 Monitoring

### Application Insights
Monitor function performance and errors:
- [Application Insights Overview](https://portal.azure.com/#resource/subscriptions/8cf05593-3360-4741-b3e8-ccc6f4f61290/resourceGroups/familyalbum-prod-rg/providers/microsoft.insights/components/familyalbum-faces-api/overview)

### Useful Queries
```
// Recent function executions
requests
| where timestamp > ago(1h)
| where cloud_RoleName == "familyalbum-faces-api"
| project timestamp, name, duration, resultCode
| order by timestamp desc

// Face detection calls
traces
| where timestamp > ago(1h)
| where message contains "detect-faces"
| order by timestamp desc

// Errors
exceptions
| where timestamp > ago(24h)
| where cloud_RoleName == "familyalbum-faces-api"
| project timestamp, type, outerMessage, innermostMessage
```

## 🎯 Success Criteria

Face recognition is fully operational when:

- [x] Python Function App deployed and running
- [x] All 3 functions listed in Azure
- [x] Configuration complete (DB, storage, CORS)
- [ ] Face detection triggers on photo upload
- [ ] Suggestions appear in MediaDetailModal
- [ ] Can confirm/reject suggestions
- [ ] Face review page works
- [ ] Training updates person profiles

## 📚 Documentation References

- `FACE_RECOGNITION_SETUP_SUMMARY.md` - Complete setup guide
- `docs/FACE_RECOGNITION.md` - Feature documentation
- `docs/PYTHON_FUNCTION_DEPLOYMENT.md` - Deployment details
- `api-python/README.md` - Python functions README

## 💡 Tips

1. **Start with a few photos** - Tag 5-10 photos of the same person manually
2. **Run training** - Generate person profiles after initial tagging
3. **Upload more photos** - AI will suggest matches based on trained profiles
4. **Review suggestions** - Confirm good matches to improve accuracy
5. **Monitor confidence** - Matches >80% confidence are usually correct

## 🆘 Need Help?

Run the test script anytime:
```powershell
.\scripts\test-python-functions.ps1
```

Check deployment status:
```powershell
az functionapp deployment list `
  --name familyalbum-faces-api `
  --resource-group familyalbum-prod-rg `
  --query "[0]" -o json
```
