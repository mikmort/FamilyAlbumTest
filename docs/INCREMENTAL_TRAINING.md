# Incremental Face Recognition Training

This document describes the incremental training system that allows users to quickly get baseline face recognition working, then progressively improve accuracy.

## Overview

The "Train Now" button in Admin Settings uses a two-phase approach:

1. **Baseline Training** (First Run): Process up to 5 photos per person for quick initial results
2. **Full Training** (Subsequent Runs): Use the full smart sampling algorithm for maximum accuracy

This approach allows users to get face recognition working quickly with minimal processing time, then improve it incrementally.

## How It Works

### Phase Detection

When "Train Now" is clicked, the system:

1. Queries the `PersonEncodings` table to check if any trained models exist
2. If `trainedPersons = 0`: Run **baseline training**
3. If `trainedPersons > 0`: Run **full training**

### Baseline Training (First Run)

**Seeding:**
- Processes up to 100 photos
- Limits to maximum 5 photos per person (`maxPerPerson=5`)
- Uses most recent photos (ordered by `PYear DESC, PMonth DESC`)
- Creates confirmed `FaceEncodings` from manual tags

**Training:**
- Uses minimal sample size (5 faces per person)
- Quick processing for immediate results
- Provides baseline face recognition capability

**Benefits:**
- Fast initial setup (seconds instead of minutes)
- Users can start testing face recognition immediately
- Reduces cost on first run

### Full Training (Subsequent Runs)

**Seeding:**
- Processes up to 50 remaining photos
- No per-person limit (processes all unprocessed tagged photos)
- Continues building the face encoding database

**Training:**
- Uses full logarithmic sampling algorithm
- Samples across timeline for aging/appearance diversity
- Maximum accuracy for production use

**Sample Sizes (Full Training):**
- 10 faces → 10 (100%)
- 50 faces → 44 (88%)
- 100 faces → 50 (50%)
- 500 faces → 64 (13%)
- 1000 faces → 70 (7%)
- 5000 faces → 84 (1.7%)

## User Interface

### Train Now Button

The button behavior:
- **First click**: Shows "Processing tagged photos (up to 5 per person) for baseline training..."
- **Subsequent clicks**: Shows "Processing any new manually-tagged photos..."

### Cancel Button

A red "Cancel" button appears during training:
- Allows user to abort long-running operations
- Cancellation is checked between seeding and training steps
- Status shows "Training cancelled by user"

### Status Messages

The UI shows different messages based on training phase:

**Baseline Training:**
- "Baseline training complete!"
- Shows statistics: photos processed, faces detected/matched/unmatched

**Full Training:**
- "Full training complete!"
- Shows statistics plus sampling percentages per person

## API Endpoints

### POST /api/faces/check-training-status

Check if baseline training has been completed.

**Response:**
```json
{
  "success": true,
  "trainedPersons": 42
}
```

### POST /api/faces/seed

Seed face encodings from existing manual tags.

**Request:**
```json
{
  "limit": 100,        // Max photos to process
  "maxPerPerson": 5    // Optional - limit photos per person
}
```

**Response:**
```json
{
  "success": true,
  "photosProcessed": 50,
  "facesDetected": 123,
  "facesMatched": 115,
  "facesUnmatched": 8
}
```

### POST /api/faces/train

Train face recognition models.

**Request:**
```json
{
  "quickTrain": true   // Optional - use minimal samples for baseline
}
```

**Response:**
```json
{
  "success": true,
  "personsUpdated": 25,
  "details": [
    {
      "personName": "John Doe",
      "totalFaces": 100,
      "encodingCount": 50,
      "samplePercentage": 50
    }
  ]
}
```

## Database Schema

### FaceEncodings Table

Stores individual face detections:
- `PFileName`: Photo filename
- `PersonID`: Person identified (NULL for unmatched)
- `Encoding`: 128D face vector (binary)
- `IsConfirmed`: 1 for manual tags, 0 for auto-detected
- `Confidence`: Match confidence score
- `Distance`: Face comparison distance

### PersonEncodings Table

Stores aggregate training data:
- `PersonID`: Person identifier
- `Encoding`: Mean encoding from samples (binary)
- `EncodingCount`: Number of samples used
- `TotalFaces`: Total confirmed faces available
- `LastTrainedAt`: Training timestamp

## Implementation Details

### faces-seed/__init__.py

**Baseline Query (maxPerPerson set):**
```sql
WITH RankedPhotos AS (
  SELECT ...,
    ROW_NUMBER() OVER (PARTITION BY ne.ID ORDER BY p.PYear DESC, p.PMonth DESC) as PersonRank
  FROM ...
  WHERE NOT EXISTS (SELECT 1 FROM FaceEncodings WHERE PersonID = ne.ID)
)
SELECT TOP (?)
FROM RankedPhotos
WHERE PersonRank <= ?  -- maxPerPerson limit
```

**Full Query (maxPerPerson NULL):**
```sql
SELECT TOP (?)
FROM Pictures p
WHERE NOT EXISTS (SELECT 1 FROM FaceEncodings WHERE PFileName = p.PFileName)
```

### faces-train/__init__.py

**Sample Size Calculation:**
```python
def calculate_sample_size(total_faces, quick_train=False):
    if quick_train:
        return min(total_faces, 5)  # Baseline: 5 faces max
    
    if total_faces <= 10:
        return total_faces
    
    # Logarithmic scaling: 10 + 20*log10(n)
    sample_size = int(10 + 20 * math.log10(total_faces))
    return min(sample_size, 120)
```

## Cost Optimization

### Baseline Training
- Processes ~5 faces per person
- Typical cost: FREE (within Azure free tier)
- Processing time: 10-30 seconds

### Full Training
- Uses logarithmic sampling (70-98% reduction)
- Typical cost: FREE for most users
- Processing time: 1-5 minutes depending on collection size

## Testing

### Manual Testing

1. **First Run (Baseline):**
   ```
   1. Ensure PersonEncodings table is empty
   2. Click "Train Now"
   3. Should see: "Processing tagged photos (up to 5 per person)..."
   4. Should complete quickly (10-30 seconds)
   5. Check: PersonEncodings should have entries with EncodingCount ~5
   ```

2. **Second Run (Full):**
   ```
   1. Click "Train Now" again
   2. Should see: "Processing any new manually-tagged photos..."
   3. May take longer (1-5 minutes)
   4. Check: PersonEncodings should have higher EncodingCount
   ```

3. **Cancel Button:**
   ```
   1. Click "Train Now"
   2. Click "Cancel" button during processing
   3. Should see: "Training cancelled by user"
   4. Check: Partial results may be saved
   ```

### Automated Testing

```typescript
// Test baseline training detection
const response = await fetch('/api/faces/check-training-status');
const { trainedPersons } = await response.json();
expect(trainedPersons).toBeGreaterThanOrEqual(0);

// Test with quickTrain parameter
const trainResponse = await fetch('/api/faces/train', {
  method: 'POST',
  body: JSON.stringify({ quickTrain: true })
});
```

## Monitoring

### Logs to Check

**Azure Functions Logs (Python):**
- "Training parameters: personId=None, quickTrain=True"
- "Seeding parameters: limit=100, maxPerPerson=5"
- "Training John Doe (baseline): using 5 of 10 faces (50% sample)"
- "Training John Doe (full): using 50 of 100 faces (50% sample)"

**Application Insights:**
- Face seeding requests: Duration, success rate
- Face training requests: Duration, success rate
- Training status checks: Frequency, results

### Performance Metrics

Monitor:
- Baseline training time (target: < 30 seconds)
- Full training time (target: < 5 minutes for 50 people)
- Seeding throughput (photos per second)
- Training throughput (persons per second)

## Troubleshooting

### "No tagged photos found"
- User needs to manually tag some photos first
- Check NamePhoto table has entries
- Verify photos exist in Pictures table

### Training takes too long
- Use Cancel button to abort
- Check PersonEncodings - baseline may already exist
- Review logs for specific person causing delay

### Baseline training keeps running
- PersonEncodings table may be empty
- Check training completed successfully on first run
- Verify MERGE query in faces-train is working

### Sample sizes seem wrong
- Baseline should use 5 faces max per person
- Full training should use logarithmic scaling
- Check quickTrain parameter is being passed correctly

## Future Enhancements

Potential improvements:
1. **Progress bar**: Show real-time progress during training
2. **Batch size control**: Let users configure photos per run
3. **Scheduled training**: Auto-train on schedule (nightly)
4. **Smart baseline**: Auto-detect optimal baseline size per person
5. **Resume capability**: Save state and resume cancelled training

## See Also

- [SMART_SAMPLING_ALGORITHM.md](./SMART_SAMPLING_ALGORITHM.md) - Details on logarithmic sampling
- [AUTO_TRAINING_SYSTEM.md](./AUTO_TRAINING_SYSTEM.md) - Automatic training triggers
- [RBAC_SYSTEM.md](./RBAC_SYSTEM.md) - Admin permissions for training
