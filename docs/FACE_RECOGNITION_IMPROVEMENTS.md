# Face Recognition Training Improvements

## Problem Identified

Face recognition was suggesting wrong people with high confidence (93-98%) because:

1. **Training data included group photos**: Amy Lynn Hodges had 1196 embeddings from photos containing 4-11 people (wedding photos)
2. **All faces were treated as the target person**: When training on a photo tagged with "Amy," the system extracted embeddings from ALL faces detected, not just Amy's face
3. **Detection was too sensitive**: Detecting 8 faces in a 3-person photo

## Root Cause

The training process:
1. Took photos tagged with a person's name
2. Used `detectSingleFace()` which would detect ANY face in the image
3. Stored that embedding as belonging to the person
4. Result: Person's face profile included faces of family members, wedding guests, etc.

## Solutions Implemented

### 1. Cleared Corrupted Training Data ✅

Created `scripts/clear-bad-training-data.js` to remove bad embeddings:
- Deleted 873 embeddings for Adam Hodges
- Deleted 1196 embeddings for Amy Lynn Hodges (Morton)

### 2. Improved Face Detection Logic ✅

Modified `lib/faceRecognition.ts` - `detectFaceWithEmbedding()`:

**Before:**
- Used `detectSingleFace()` - would detect first/random face
- No filtering for group photos
- No face selection logic

**After:**
- Detects all faces first
- **Skips photos with >3 people** (configurable maxFaces parameter)
- **Selects largest face** by bounding box area (usually the main subject)
- Logs selection decisions for debugging

```typescript
// Example: In a couple photo, selects the person closest to camera
// In a group photo with >3 people, returns null (skips photo)
```

### 3. Improved Training Photo Selection ✅

Modified `api/faces-tagged-photos/index.js`:

**Smart Sampling Mode:**
- **Filters out group photos** (>3 people tagged)
- **Prioritizes solo/couple photos** by people count
- Sorts by: people count (ascending), then date
- Distributes samples across timeline

**Fixed Limit Mode:**
- Added people count filtering
- Prioritizes photos with fewer people
- Sorts by: people count, then filename

**All Photos Mode:**
- Filters out group photos (>3 people)
- Prioritizes solo/couple photos
- Returns sorted by people count

## Training Best Practices

### Good Training Photos:
✅ Solo portraits
✅ Couple photos (2 people)
✅ Small group photos (3 people max)
✅ Clear, front-facing shots
✅ Well-lit photos
✅ Person is main subject (largest face)

### Bad Training Photos:
❌ Wedding/party group photos (>3 people)
❌ Person in background
❌ Poor lighting/blurry
❌ Partial face/profile only
❌ Person is small in frame

## Detection Parameters

### Training (detectFaceWithEmbedding):
- **minConfidence**: 0.6
- **maxFaces**: 3 (configurable, default for training)
- Selects largest face if multiple detected

### Recognition (detectAllFacesWithEmbeddings):
- **minConfidence**: 0.6 (0.7 in ProcessNewFiles)
- Returns all faces above threshold
- Filters by confidence score

## Next Steps

1. **Retrain Adam and Amy** with improved logic
   - Go to Admin Settings → Face Recognition Training
   - Click "Train Face Recognition"
   - System will now use only good training photos

2. **Test Recognition** on the problematic photo
   - Should detect fewer faces (3 instead of 8)
   - Should suggest correct people
   - Confidence should reflect actual similarity

3. **Monitor Training Stats**
   - Check which photos are used for training
   - Verify people count per photo
   - Look for skipped group photos in logs

4. **Future Improvements** (if needed):
   - Add manual face selection UI (click to tag specific face)
   - Implement face size/centrality scoring
   - Add "report wrong match" feature
   - Create admin tool to view/delete embeddings per person

## Database Schema

Training data stored in `FaceEmbeddings` table:
```sql
ID, PersonID, PhotoFileName, Embedding (128-dim JSON), CreatedDate, UpdatedDate
```

To check training data:
```bash
node scripts/check-training-data.js      # Overall stats
node scripts/check-training-photos.js    # Photo details
```

To clear specific person's data:
```bash
node scripts/clear-bad-training-data.js  # Clears Adam & Amy
```

## Testing Results

Before fixes:
- ❌ 8 faces detected in 3-person photo
- ❌ Adam Hodges suggested for all faces (93-98% confidence)
- ❌ Amy Lynn suggested for all faces (93-98% confidence)

Expected after retraining:
- ✅ 3 faces detected (actual number of people)
- ✅ Correct people suggested for each face
- ✅ Reasonable confidence scores (60-80% for matches)
- ✅ No suggestions if faces don't match training data

## Files Modified

1. `lib/faceRecognition.ts` - Improved face detection logic
2. `api/faces-tagged-photos/index.js` - Filter and prioritize good training photos
3. `scripts/clear-bad-training-data.js` - New cleanup script
4. `scripts/check-training-photos.js` - New diagnostic script

## Configuration

Key parameters can be adjusted in:

**`lib/faceRecognition.ts`:**
```typescript
detectFaceWithEmbedding(image, maxFaces = 3)  // Max people in training photo
```

**`api/faces-tagged-photos/index.js`:**
```sql
AND (... ) <= 3  -- Max people tagged in photo
```

Increase these values if you want to include larger group photos, but this may reduce accuracy.
