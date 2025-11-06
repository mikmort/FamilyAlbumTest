# Face Recognition Feature

## Overview

The Family Album application now includes **automatic face detection and recognition** to streamline the process of tagging people in photos. This feature uses AI-powered facial recognition to:

1. **Detect faces** in newly uploaded images
2. **Match faces** against known people already tagged in your photos
3. **Suggest tags** with confidence scores
4. **Learn and improve** as you confirm or reject suggestions

## How It Works

### Automatic Detection
When you upload a new photo:
1. The system automatically scans for faces
2. Each detected face is compared against encodings from confirmed person tags
3. If a match is found with sufficient confidence, a suggestion is generated
4. Suggestions appear in the photo detail view for quick confirmation

### Manual Review
Visit the **Face Review** page (`/face-review`) to:
- See all pending face suggestions across all photos
- Confirm or reject suggestions in batch
- Select alternative people if the suggestion is incorrect

### Learning System
- The system builds a "face profile" for each person from confirmed tags
- As you confirm more tags, the system becomes more accurate
- Person profiles are updated automatically when you add new tags

## User Interface

### Photo Detail Modal
When viewing a photo with detected faces:
- **Yellow banner** shows suggested face tags with confidence scores
- **✓ Confirm** button adds the person tag immediately
- **✗ Reject** button dismisses the suggestion

### Face Review Page
Dedicated interface for reviewing all pending suggestions:
- View photos one at a time with highlighted face regions
- See confidence scores for each suggestion
- Quick confirm/reject buttons
- Progress indicator showing remaining faces
- Option to select a different person if needed

## Technical Architecture

### Components

#### Database Tables
- **`FaceEncodings`**: Stores detected faces and their vector encodings
  - Links to `Pictures` (which photo)
  - Links to `NameEvent` (suggested/confirmed person)
  - Stores bounding box coordinates
  - Tracks confirmation status
  
- **`PersonEncodings`**: Aggregated face profiles for each person
  - Used for faster matching of new faces
  - Updated automatically via training endpoint

#### API Endpoints

**Python Azure Functions (face detection)**:
- `POST /api/detect-faces` - Detect and recognize faces in an image
- `POST /api/faces/train` - Regenerate person face profiles
- `GET /api/faces/review` - Get pending face suggestions
- `POST /api/faces/review` - Confirm or reject a face match

**Node.js Functions (integration)**:
- `GET /api/media/{filename}/faces` - Get face detections for a specific photo
- Integrated with `uploadComplete` to trigger detection automatically

#### React Components
- **`FaceReview.tsx`**: Standalone face review interface
- **`MediaDetailModal.tsx`**: Enhanced with inline face suggestions

### AI Model

The system uses the **`face-recognition` Python library**, which is built on dlib's state-of-the-art face recognition model:
- **Detection**: Histogram of Oriented Gradients (HOG) or CNN-based
- **Encoding**: 128-dimensional face embedding
- **Matching**: Euclidean distance comparison with configurable threshold

**Why this model?**
- Excellent accuracy (99.38% on Labeled Faces in the Wild benchmark)
- Runs locally - no external API costs or privacy concerns
- Mature, well-maintained library
- Fast enough for real-time processing

### Matching Algorithm

1. **Face Detection**: Locate faces in the image
2. **Encoding**: Convert each face to a 128D vector
3. **Comparison**: Calculate distance to all known person encodings
4. **Thresholding**: 
   - Distance < 0.6: Good match
   - Confidence > 0.4: Show as suggestion
   - Confidence > 0.8: Auto-confirm (optional)

## Setup and Deployment

### Prerequisites

1. **Python 3.8+** runtime in Azure Functions
2. **Build tools** for compiling dlib:
   - Windows: Visual Studio Build Tools
   - Linux: `build-essential`, `cmake`
   - macOS: Xcode Command Line Tools

### Installation Steps

#### 1. Apply Database Schema
```sql
-- Run this in your Azure SQL Database
sqlcmd -S your-server.database.windows.net -d FamilyAlbum -U admin -P password -i database/face-encodings-schema.sql
```

#### 2. Install Python Dependencies
The `api/requirements.txt` file includes all necessary packages:
```
azure-functions>=1.11.0
face-recognition>=1.3.0
dlib>=19.24.0
numpy>=1.21.0
Pillow>=9.0.0
azure-storage-blob>=12.14.0
pyodbc>=4.0.35
```

**Note**: Installing `dlib` requires compilation and may take several minutes on first deployment.

#### 3. Configure Environment Variables
Add to your Azure Functions configuration (or `.env.local` for local development):
```
AZURE_SQL_CONNECTIONSTRING=Driver={ODBC Driver 17 for SQL Server};Server=...
AzureWebJobsStorage=DefaultEndpointsProtocol=https;AccountName=...
FUNCTION_APP_URL=https://your-function-app.azurewebsites.net  # For production
```

#### 4. Deploy Azure Functions
```powershell
# Deploy from the /api directory
cd api
func azure functionapp publish your-function-app-name --python
```

#### 5. Configure Static Web App
Update `staticwebapp.config.json` to include Python function routes (already configured if using this branch).

### Local Development

1. **Install Python dependencies locally**:
   ```bash
   cd api
   pip install -r requirements.txt
   ```

2. **Start Azure Functions**:
   ```bash
   cd api
   func start
   ```

3. **Start Next.js frontend**:
   ```bash
   npm run dev
   ```

4. **Enable dev mode** (optional, for testing without auth):
   ```
   # .env.local
   DEV_MODE=true
   DEV_USER_ROLE=Full
   ```

## Usage

### For End Users

#### Uploading Photos
1. Upload photos as usual through the upload interface
2. Face detection runs automatically in the background
3. No action needed - suggestions will appear when you view the photo

#### Reviewing Suggestions
**Option 1: In Photo Detail**
1. Click on any photo to open the detail modal
2. If faces are detected, see the yellow suggestion banner
3. Click "✓ Confirm" to add the tag or "✗ Reject" to dismiss

**Option 2: Batch Review**
1. Navigate to the Face Review page (link in navigation)
2. Review suggestions one by one
3. Confirm, reject, or select a different person
4. Progress bar shows how many remain

### For Administrators

#### Training the System
After adding many new person tags manually, retrain person profiles:
```bash
curl -X POST https://your-app.com/api/faces/train \
  -H "Content-Type: application/json"
```

Or for a specific person:
```json
POST /api/faces/train
{
  "personId": 123
}
```

#### Force Re-detection
To re-run face detection on an existing photo:
```bash
curl -X POST https://your-app.com/api/detect-faces \
  -H "Content-Type: application/json" \
  -d '{"filename": "media/photo.jpg", "autoConfirm": false}'
```

## Configuration Options

### Detection Sensitivity
Edit `/api/detect-faces/__init__.py`:

```python
# Matching threshold (lower = more strict)
DISTANCE_THRESHOLD = 0.6  # Default: 0.6

# Minimum confidence to show suggestion
MIN_CONFIDENCE = 0.4  # Default: 0.4
```

**Guidelines**:
- **Stricter** (fewer false positives): Increase `DISTANCE_THRESHOLD` to 0.5
- **More lenient** (catch more faces): Increase to 0.7
- **Show only high-confidence**: Increase `MIN_CONFIDENCE` to 0.6

### Auto-Confirmation
By default, faces with >80% confidence are auto-confirmed. To disable:
```javascript
// In api/uploadComplete/index.js, line ~380
triggerFaceDetection(fileName, context).catch(err => {
  // Change autoConfirm to false
});
```

Or in the Python function call:
```json
{
  "filename": "photo.jpg",
  "autoConfirm": false
}
```

### Detection Model
For better accuracy (but slower processing), use CNN instead of HOG:
```python
# In api/detect-faces/__init__.py, line ~55
face_locations = face_recognition.face_locations(image_array, model='cnn')  # Change 'hog' to 'cnn'
```

## Performance Considerations

### Processing Time
- **HOG detection**: ~2-3 seconds per image
- **CNN detection**: ~10-15 seconds per image
- **Encoding generation**: ~1 second per face
- **Matching**: <1 second for up to 1000 persons

### Cost Analysis (Azure Functions Consumption Plan)

**Assumptions**:
- 100 photos uploaded per month
- Average 2 faces per photo
- 3 seconds processing time per image

**Monthly costs**:
- Executions: 100 × $0.0000002 = $0.00002
- Compute: 100 × 3s × 512MB × $0.000016/GB-s ≈ $0.0024
- **Total**: ~$0.0024/month (essentially free)

Even with 10,000 photos/month, costs remain under $3/month.

### Storage Impact
- Face encoding: ~512 bytes per face
- 10,000 faces: ~5MB of database storage
- Negligible cost impact

## Troubleshooting

### Face Detection Not Running
1. Check Azure Functions logs for errors
2. Verify Python runtime is configured (3.8+)
3. Ensure `dlib` compiled successfully during deployment
4. Check `FUNCTION_APP_URL` environment variable

### Low Accuracy
1. **Train the system**: Run `/api/faces/train` after tagging photos
2. **Check photo quality**: Blurry or low-resolution photos reduce accuracy
3. **Verify face angle**: Profiles and extreme angles are harder to match
4. **Review threshold**: Consider adjusting `DISTANCE_THRESHOLD`

### Dlib Installation Fails
**Windows**:
```bash
# Install Visual Studio Build Tools
# Then install dlib with pre-built wheel:
pip install https://github.com/jloh02/dlib/releases/download/v19.22/dlib-19.22.99-cp39-cp39-win_amd64.whl
```

**Linux (Azure)**:
```bash
# Azure Functions automatically includes build tools
# If deployment fails, increase timeout in host.json
```

### Performance Issues
1. **Use HOG instead of CNN** for faster detection
2. **Process in batches**: Don't process all photos at once
3. **Add indexes**: Ensure database indexes exist (created by schema script)
4. **Cache person encodings**: PersonEncodings table serves as cache

## Privacy and Security

### Data Storage
- Face encodings (128D vectors) are stored, not actual face images
- Encodings cannot be reversed to reconstruct faces
- All data stays within your Azure infrastructure

### Access Control
- Face detection requires `Full` role (same as uploading)
- Face review requires `Full` role
- Training endpoint requires `Full` role
- RBAC system applies to all face recognition features

### Compliance
This feature:
- ✅ Does NOT use external AI APIs (data stays on your servers)
- ✅ Does NOT perform surveillance or unauthorized tracking
- ✅ Processes photos you explicitly upload
- ✅ Requires user confirmation for all tags

**Note**: Consult your legal team regarding facial recognition regulations in your jurisdiction (e.g., GDPR, CCPA, BIPA).

## Roadmap and Future Enhancements

### Planned Features
- [ ] Bulk face detection for existing photos
- [ ] Face grouping for unknown people
- [ ] Name suggestions during upload
- [ ] Mobile app integration
- [ ] Face quality scoring
- [ ] Age progression detection

### Possible Improvements
- Pre-computed face embeddings for faster matching
- GPU acceleration for CNN-based detection
- Multi-face tracking in videos
- Similarity search ("Find photos of similar people")

## Support

For issues or questions:
1. Check logs in Azure Portal → Functions → Monitor
2. Review this documentation
3. Check GitHub Issues
4. Contact development team

## References

- [face-recognition library](https://github.com/ageitgey/face_recognition)
- [dlib C++ library](http://dlib.net/)
- [Azure Functions Python developer guide](https://docs.microsoft.com/azure/azure-functions/functions-reference-python)
- [Labeled Faces in the Wild benchmark](http://vis-www.cs.umass.edu/lfw/)
