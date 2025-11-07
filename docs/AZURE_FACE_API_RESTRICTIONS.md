# Azure Face API Restrictions and Workarounds

## ⚠️ IMPORTANT: Limited Access Requirements

As of 2022, Microsoft has restricted access to certain Azure Face API features under their "Responsible AI" policy.

## What Requires Approval

The following features **REQUIRE Microsoft approval** through a Limited Access request:

- ❌ **PersonGroup operations** (create, train, identify)
- ❌ **Face identification** (1:N matching)
- ❌ **Face verification** (1:1 matching)
- ❌ **Face grouping**
- ❌ **Person creation and management**

### Deprecated Features (No longer available)
- ❌ Emotion recognition
- ❌ Age estimation
- ❌ Gender estimation
- ❌ Facial attributes (smile, hair, etc.)

## What Does NOT Require Approval

These features are publicly available:

- ✅ **Face Detection** - Get bounding boxes for faces in images
- ✅ **Face landmarks** - Get facial feature coordinates
- ✅ **Face ID generation** - Temporary GUID for same-session correlation

## Our Architecture

### Current Working Setup

1. **Azure Face API (Face Detection only)**
   - Endpoint: `https://eastus2.api.cognitive.microsoft.com/`
   - Used for: Detecting faces and getting bounding boxes
   - API Call: `POST /face/v1.0/detect?detectionModel=detection_03&returnFaceId=false`
   - **No approval needed** ✅

2. **face-api.js (Local Browser-based)**
   - Library: TensorFlow.js-based face recognition
   - Used for: Face training and recognition
   - Location: `lib/faceRecognition.ts`
   - Models: Stored in `public/models/`
   - **Runs entirely in browser** ✅

### Removed/Deprecated Code

The following code was removed because it requires Microsoft approval:

- ❌ `api-python/faces-seed/__init__.py` - Azure PersonGroups seeding
- ❌ `api-python/faces-train/__init__.py` - Azure PersonGroups training
- ❌ `api-python/shared_python/face_client.py` - PersonGroup management
- ❌ `api/faces/seed/index.js` - Node.js proxy to Python functions
- ❌ `components/AdminSettings.tsx` - `trainAzureFaces()` function

## How to Apply for Limited Access

If you need Azure Face API PersonGroups features:

1. Visit: https://aka.ms/facerecognition
2. Submit a Limited Access request form
3. Explain your use case and data handling
4. Agree to Responsible AI terms
5. Wait for manual review (approval time varies)

### Approved Use Cases
Microsoft typically approves:
- Employee/customer authentication with consent
- Access control for secure facilities
- Personalized retail/banking with explicit consent
- Lawful government identity matching

## Testing Face Detection

You can test the publicly available Face Detection API:

```bash
curl -X POST "https://eastus2.api.cognitive.microsoft.com/face/v1.0/detect?detectionModel=detection_03&returnFaceId=false" \
  -H "Ocp-Apim-Subscription-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/photo.jpg"}'
```

Expected response:
```json
[
  {
    "faceRectangle": {
      "top": 120,
      "left": 250,
      "width": 85,
      "height": 85
    }
  }
]
```

## Local Face Recognition (face-api.js)

Our working face recognition uses face-api.js:

### Key Files
- **Training**: `components/AdminSettings.tsx` - `trainFaces()` function
- **Recognition**: `lib/faceRecognition.ts`
- **Models**: `public/models/` (TensorFlow.js models)

### How It Works
1. User clicks "Train Now" button
2. Loads face-api.js models (~6MB, one-time)
3. Fetches photos with manual tags from database
4. Generates 128-dimensional embeddings for each face (in browser)
5. Stores embeddings in IndexedDB
6. During recognition, compares new faces against stored embeddings

### Advantages
- ✅ No Microsoft approval needed
- ✅ Privacy-friendly (runs in browser)
- ✅ No API usage costs
- ✅ Works offline after models loaded

### Disadvantages
- ❌ Requires browser with good CPU/GPU
- ❌ Initial model download (~6MB)
- ❌ Training happens per-device (not shared across users)

## Migration Guide

If you have existing Azure PersonGroups code:

### Before (Doesn't Work)
```typescript
const trainResponse = await fetch('/api/faces/seed', {
  method: 'POST',
  body: JSON.stringify({ limit: 100 })
});
```

### After (Works)
```typescript
import { loadFaceModels, detectFaceWithEmbedding } from '@/lib/faceRecognition';

// Load models first time
await loadFaceModels();

// Process image
const image = document.getElementById('myImage');
const result = await detectFaceWithEmbedding(image);
if (result) {
  // Store result.descriptor (128-dim embedding)
  // Use for recognition later
}
```

## Related Documentation

- [Azure Face API Documentation](https://learn.microsoft.com/en-us/azure/ai-services/computer-vision/overview-identity)
- [Limited Access Policy](https://learn.microsoft.com/en-us/legal/cognitive-services/computer-vision/limited-access-identity)
- [face-api.js Documentation](https://github.com/justadudewhohacks/face-api.js)

## Last Updated

November 7, 2025 - Removed Azure PersonGroups code and documented restrictions
