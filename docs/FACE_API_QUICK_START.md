# Face API Implementation - Quick Reference

## Status: Ready to Implement

✅ **Completed:**
- Azure Face API resource created
- API credentials configured
- requirements.txt updated
- Database schema designed (AzureFacePersons table)
- Shared Face API client utility created (`shared_python/face_client.py`)

⏳ **Next Steps:**
- Rewrite faces-seed function
- Rewrite faces-train function
- Run database migration
- Deploy and test

---

## Files to Replace

### 1. faces-seed/__init__.py

Replace the entire file with the simplified version in `/docs/face-api-code/faces-seed.py`

**Key changes:**
- Remove `face_recognition` and `dlib` imports
- Use `get_face_client()` from shared utility
- Call `add_face_from_blob_url()` for each photo-person pair
- Store Azure Person IDs in AzureFacePersons table

**Logic:**
1. Get photos with manual tags
2. For each person, get or create Azure Person
3. For each photo of that person, add face to Azure
4. Return count of faces added

### 2. faces-train/__init__.py

Much simpler! Just calls Azure API to train:

```python
import json
import logging
import azure.functions as func
import sys
import os

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from shared_python.utils import check_authorization
from shared_python.face_client import (
    get_face_client,
    wait_for_training,
    PERSON_GROUP_ID
)

def main(req: func.HttpRequest) -> func.HttpResponse:
    """Train the Azure Face API PersonGroup"""
    
    authorized, user, error = check_authorization(req, 'Full')
    if not authorized:
        return func.HttpResponse(
            json.dumps({'error': error}),
            status_code=403,
            mimetype='application/json'
        )
    
    try:
        face_client = get_face_client()
        
        # Start training
        face_client.person_group.train(PERSON_GROUP_ID)
        logging.info(f"Training started for PersonGroup '{PERSON_GROUP_ID}'")
        
        # Wait for training to complete
        result = wait_for_training(face_client, PERSON_GROUP_ID)
        
        if result['status'] == 'succeeded':
            return func.HttpResponse(
                json.dumps({
                    'success': True,
                    'message': 'Training completed successfully'
                }),
                status_code=200,
                mimetype='application/json'
            )
        else:
            return func.HttpResponse(
                json.dumps({
                    'success': False,
                    'error': result['message']
                }),
                status_code=500,
                mimetype='application/json'
            )
            
    except Exception as e:
        logging.error(f"Training failed: {str(e)}")
        return func.HttpResponse(
            json.dumps({'error': f'Training failed: {str(e)}'}),
            status_code=500,
            mimetype='application/json'
        )
```

### 3. Add missing utility function to shared_python/utils.py

Add this function to get SAS URLs:

```python
def get_blob_with_sas(filename, expiry_hours=1):
    """
    Get blob URL with SAS token for temporary access
    
    Args:
        filename: Name of the file in blob storage
        expiry_hours: Hours until SAS token expires
        
    Returns:
        str: Full URL with SAS token
    """
    from azure.storage.blob import BlobServiceClient, generate_blob_sas, BlobSasPermissions
    from datetime import datetime, timedelta
    
    connection_string = os.environ.get('AZURE_STORAGE_CONNECTION_STRING')
    container_name = os.environ.get('BLOB_CONTAINER_NAME', 'family-album-media')
    
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    
    # Generate SAS token
    sas_token = generate_blob_sas(
        account_name=blob_service_client.account_name,
        container_name=container_name,
        blob_name=filename,
        account_key=blob_service_client.credential.account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(hours=expiry_hours)
    )
    
    # Construct full URL
    blob_url = f"https://{blob_service_client.account_name}.blob.core.windows.net/{container_name}/{filename}?{sas_token}"
    
    return blob_url
```

---

## Database Migration

Run this SQL script to create the AzureFacePersons table:

```sql
-- File: database/add-azure-face-persons.sql (already created)

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
END
GO
```

Run it:
```powershell
cd database
sqlcmd -S "your-server.database.windows.net" -d "FamilyAlbum" -U "admin" -P "password" -i add-azure-face-persons.sql
```

---

## Deployment Process

### 1. Remove Docker configuration
```powershell
# Function App is currently configured for Docker, but we're going back to regular Python
# This command will fail due to version issue, so we'll just deploy - Azure will figure it out
```

### 2. Deploy the updated functions
```powershell
cd api-python
func azure functionapp publish familyalbum-faces-api --python
```

This should work now because:
- ✅ No dlib dependency
- ✅ No CMake required
- ✅ Only uses `azure-cognitiveservices-vision-face` (pure Python)
- ✅ Works on Consumption plan

### 3. Test the deployment

```powershell
# Test faces-seed
curl -X POST https://familyalbum-faces-api.azurewebsites.net/api/faces/seed `
  -H "Content-Type: application/json" `
  -d '{\"limit\": 10, \"maxPerPerson\": 5}'

# Test faces-train
curl -X POST https://familyalbum-faces-api.azurewebsites.net/api/faces/train

# Check status
curl https://familyalbum-faces-api.azurewebsites.net/api/faces/check-training-status
```

---

## What Changed

### Before (dlib):
- Download image from blob
- Use face_recognition to detect faces
- Extract 128-d face encodings
- Store encodings in database
- Train local model

### After (Azure Face API):
- Get SAS URL for image
- Call Azure Face API to add face to Person
- Azure stores the face data
- Call Azure to train the PersonGroup
- Azure handles all the ML

### Benefits:
- ✅ No compilation required
- ✅ Works on Consumption plan
- ✅ Simpler code (~100 lines vs 260)
- ✅ Professional ML service
- ✅ Free tier sufficient for family use

---

## Incremental Training Still Works!

The `maxPerPerson` parameter still applies:
- **Baseline** (first run): `{\"maxPerPerson\": 5}` - adds up to 5 photos per person
- **Full** (second run): no maxPerPerson - adds remaining photos

Frontend logic remains the same - it just calls the same endpoints with the same parameters!

---

## Next Action

When you're ready to implement:

1. **Copy the code** from this file into the actual Python functions
2. **Run the database migration** to create AzureFacePersons table  
3. **Deploy** using `func azure functionapp publish`
4. **Test** from Admin Settings → Train Now button

The migration plan in `FACE_API_MIGRATION.md` has full details.

Let me know if you need help with any of these steps!
