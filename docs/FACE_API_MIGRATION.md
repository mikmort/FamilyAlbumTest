# Azure Face API Migration Plan

## Current Status

✅ **Completed:**
- Azure Face API resource created (Free tier - F0)
- API Key: `35d059d59f3c4891bdb933cb0971b36d`
- Endpoint: `https://eastus2.api.cognitive.microsoft.com/`
- Environment variables added to Function App
- requirements.txt updated to use `azure-cognitiveservices-vision-face` instead of dlib

❌ **Still using Consumption plan** (cannot run Docker containers)
❌ **Python functions need to be rewritten** to use Face API instead of dlib

---

## Why This Change?

**Problem:** dlib requires CMake to compile, which:
- Doesn't work on Azure Consumption plan
- Requires Premium plan ($150+/month)
- Has complex deployment issues

**Solution:** Azure Face API:
- ✅ No compilation required
- ✅ Works on Consumption plan
- ✅ Free tier: 30,000 transactions/month
- ✅ Simple REST API
- ✅ Cost: ~$1-5/month for typical usage

---

## Architecture Changes

### Before (dlib):
1. **faces-seed**: Extract face encodings from photos using dlib
2. **faces-train**: Train face recognition model locally using face_recognition library
3. **detect-faces**: Detect faces in new photos using dlib
4. **faces-review**: Match faces against trained model

### After (Azure Face API):
1. **faces-seed**: Create PersonGroup and add face images to Azure
2. **faces-train**: Call Azure Face API to train the PersonGroup
3. **detect-faces**: Use Azure Face API to detect faces
4. **faces-review**: Use Azure Face API to identify faces

---

## Implementation Tasks

### Task 1: Update faces-seed Function
**Current:** Extracts face encodings using dlib and stores in PersonEncodings table
**New:** 
- Create Azure Face API PersonGroup (one per family)
- For each person in NameEvent table:
  - Create Person in PersonGroup
  - Add face images from tagged photos
- Store Azure Person IDs in database

**Key Changes:**
```python
from azure.cognitiveservices.vision.face import FaceClient
from msrest.authentication import CognitiveServicesCredentials

# Initialize client
face_client = FaceClient(
    os.environ['FACE_API_ENDPOINT'],
    CognitiveServicesCredentials(os.environ['FACE_API_KEY'])
)

# Create PersonGroup (once)
person_group_id = 'family-album'
face_client.person_group.create(
    person_group_id=person_group_id,
    name='Family Album Faces'
)

# For each person
person = face_client.person_group_person.create(
    person_group_id=person_group_id,
    name=person_name
)

# Add faces
for photo_url in person_photos:
    face_client.person_group_person.add_face_from_url(
        person_group_id=person_group_id,
        person_id=person.person_id,
        url=photo_url
    )
```

### Task 2: Update faces-train Function
**Current:** Trains local face recognition model
**New:** Call Azure Face API to train the PersonGroup

**Key Changes:**
```python
# Train the PersonGroup
face_client.person_group.train(person_group_id='family-album')

# Wait for training to complete
while True:
    training_status = face_client.person_group.get_training_status('family-album')
    if training_status.status == 'succeeded':
        break
    elif training_status.status == 'failed':
        raise Exception('Training failed')
    time.sleep(1)
```

### Task 3: Update detect-faces Function
**Current:** Detects faces using dlib
**New:** Use Azure Face API to detect faces

**Key Changes:**
```python
# Detect faces in image
detected_faces = face_client.face.detect_with_url(
    url=image_url,
    return_face_id=True,
    return_face_landmarks=False
)

# Identify faces
if detected_faces:
    face_ids = [face.face_id for face in detected_faces]
    results = face_client.face.identify(
        face_ids=face_ids,
        person_group_id='family-album'
    )
```

### Task 4: Update Database Schema
**New table needed:** Store Azure Face API Person IDs

```sql
CREATE TABLE AzureFacePersons (
    PersonID INT PRIMARY KEY,  -- References NameEvent.ID
    AzurePersonID NVARCHAR(36) NOT NULL,  -- UUID from Azure
    PersonGroupID NVARCHAR(50) NOT NULL DEFAULT 'family-album',
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (PersonID) REFERENCES NameEvent(ID)
);
```

### Task 5: Incremental Training Support
The incremental training logic (quickTrain, maxPerPerson) still applies:
- **Baseline training (first run):** Add up to 5 faces per person
- **Full training (subsequent runs):** Add all remaining faces

**Implementation:**
```python
# Check if baseline training completed
baseline_complete = check_person_group_trained('family-album')

if baseline_complete:
    # Full training: add all faces
    max_faces_per_person = None
else:
    # Baseline training: limit to 5 faces
    max_faces_per_person = 5
```

---

## Deployment Steps

### Step 1: Remove Docker Configuration
```bash
# Switch Function App back to Python runtime
az functionapp config set \
  --name familyalbum-faces-api \
  --resource-group familyalbum-prod-rg \
  --linux-fx-version "Python|3.10"
```

### Step 2: Update Function Code
- Update all four Python functions to use Face API
- Test locally using Azure Functions Core Tools
- Commit changes to Git

### Step 3: Deploy to Azure
```bash
cd api-python
func azure functionapp publish familyalbum-faces-api --python
```

### Step 4: Test Face Recognition
- Go to Admin Settings
- Click "Train Now"
- Verify baseline training works (5 faces per person)
- Click "Train Now" again
- Verify full training works (all remaining faces)

---

## Cost Estimation

**Azure Face API Free Tier (F0):**
- 30,000 transactions/month (free)
- Transactions include: detect, identify, train, person CRUD

**Typical Family Album Usage:**
- Initial baseline training: ~50 people × 5 faces = 250 transactions
- Full training: ~50 people × 20 faces = 1,000 transactions
- Ongoing face detection: ~100 photos/month × 2 faces = 200 transactions
- **Total:** ~1,500 transactions/month = **FREE**

If you exceed 30K transactions/month:
- Standard tier (S0): $1 per 1,000 transactions
- Still much cheaper than Premium Function App ($150/month)

---

## Testing Checklist

After implementation:
- [ ] Create PersonGroup successfully
- [ ] Add faces for all people
- [ ] Training completes without errors
- [ ] Detect faces in new photos
- [ ] Identify faces correctly
- [ ] Pause button works during training
- [ ] Incremental training works (baseline → full)
- [ ] Check training status endpoint returns correct data

---

## Rollback Plan

If Face API doesn't work well:
1. Keep manual tagging (already works)
2. Disable automatic face detection
3. Users can still tag photos manually
4. Consider upgrading to Premium plan later if needed

---

## Next Steps

1. **Implement faces-seed function** with Face API
2. **Implement faces-train function** with Face API  
3. **Test locally** with sample data
4. **Deploy to Azure** and test end-to-end
5. **Monitor usage** and adjust as needed

---

## Resources

- [Azure Face API Documentation](https://docs.microsoft.com/azure/cognitive-services/face/)
- [Python SDK Reference](https://docs.microsoft.com/python/api/overview/azure/cognitiveservices-vision-face-readme)
- [Face API Pricing](https://azure.microsoft.com/pricing/details/cognitive-services/face-api/)
- [PersonGroup Training Guide](https://docs.microsoft.com/azure/cognitive-services/face/face-api-how-to-topics/how-to-train-person-group)
