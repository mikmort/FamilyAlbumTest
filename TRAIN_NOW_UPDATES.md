# Train Now Updates - Summary

## Changes Made

### 1. Cancel/Pause Button ✅

Added a red "Cancel" button that appears while training is in progress:
- Button shows next to "Train Now" during execution
- Checks `isPaused` state between each step (seeding, training)
- Gracefully aborts and shows "Training cancelled by user"

**Location:** `components/AdminSettings.tsx`

### 2. Incremental Training ✅

Implemented two-phase training approach:

#### Phase 1: Baseline Training (First Run)
- Processes up to 5 photos per person
- Quick initial training for immediate results
- Processes up to 100 photos total

#### Phase 2: Full Training (Subsequent Runs)
- Uses full smart sampling algorithm
- Processes remaining untagged photos
- Maximum accuracy with logarithmic scaling

**How It Detects Phase:**
1. Calls `/api/faces/check-training-status` to count trained persons
2. If `trainedPersons = 0`: Run baseline (quickTrain=true, maxPerPerson=5)
3. If `trainedPersons > 0`: Run full training (quickTrain=false, no maxPerPerson limit)

## Files Modified

### Frontend
- **components/AdminSettings.tsx**
  - Added `isPaused` state for cancel functionality
  - Added `pauseTraining()` function
  - Added cancel button to UI
  - Updated `trainFaces()` to check training status first
  - Added pause checks between steps
  - Updated status messages for baseline vs full training

### Backend - Python Functions
- **api-python/faces-seed/__init__.py**
  - Added `maxPerPerson` parameter
  - Two different queries: one with per-person limit, one without
  - Uses `ROW_NUMBER() OVER (PARTITION BY PersonID)` for baseline
  - Logs seeding parameters

- **api-python/faces-train/__init__.py**
  - Added `quickTrain` parameter
  - Updated `calculate_sample_size()` to accept `quick_train` flag
  - Returns 5 faces max when `quick_train=True`
  - Logs training mode (baseline vs full)

### Backend - Node.js API
- **api/faces/seed/index.js**
  - Updated JSDoc to document `maxPerPerson` parameter
  - Already forwards all parameters from request body

- **api/faces/train/index.js**
  - Updated JSDoc to document `quickTrain` parameter
  - Already forwards all parameters from request body

- **api/faces/check-training-status/index.js** (NEW)
  - Queries `PersonEncodings` table
  - Returns count of persons with trained models
  - Used to detect if baseline training completed

- **api/faces/check-training-status/function.json** (NEW)
  - Azure Functions configuration
  - GET endpoint at `/api/faces/check-training-status`

## User Experience

### First Time Using "Train Now"

1. User has manually tagged photos but never trained
2. Clicks "Train Now"
3. Sees: "Processing tagged photos (up to 5 per person) for baseline training..."
4. Takes 10-30 seconds (very fast)
5. Sees: "Baseline training complete! (seeded 50 faces from existing tags)"
6. Face recognition now works with basic accuracy

### Second Time Using "Train Now"

1. User clicks "Train Now" again
2. Sees: "Processing any new manually-tagged photos..."
3. Takes 1-5 minutes (longer, more thorough)
4. Sees: "Full training complete! (seeded 150 faces from existing tags)"
5. Face recognition now has high accuracy with smart sampling

### Using Cancel Button

1. User clicks "Train Now"
2. Training starts
3. User clicks red "Cancel" button
4. Training aborts gracefully
5. Sees: "Training cancelled by user"
6. Partial progress may be saved

## Technical Details

### Baseline Training Parameters
```json
{
  "seed": {
    "limit": 100,
    "maxPerPerson": 5
  },
  "train": {
    "quickTrain": true
  }
}
```

### Full Training Parameters
```json
{
  "seed": {
    "limit": 50
  },
  "train": {
    "quickTrain": false
  }
}
```

### Sample Sizes

**Baseline (quickTrain=true):**
- Any person: 5 faces maximum

**Full (quickTrain=false):**
- 10 faces → 10 (100%)
- 50 faces → 44 (88%)
- 100 faces → 50 (50%)
- 500 faces → 64 (13%)
- 1000 faces → 70 (7%)

## Testing

### Manual Test Steps

1. **Test Baseline Training:**
   ```sql
   -- Clear existing training data
   DELETE FROM PersonEncodings;
   ```
   - Click "Train Now"
   - Should complete quickly (< 30 seconds)
   - Check PersonEncodings has entries with EncodingCount around 5

2. **Test Full Training:**
   - Click "Train Now" again
   - Should take longer (1-5 minutes)
   - Check PersonEncodings has higher EncodingCount values

3. **Test Cancel:**
   - Click "Train Now"
   - Immediately click "Cancel"
   - Should abort gracefully
   - Status shows "Training cancelled by user"

### Deployment Steps

1. **Deploy Python Functions:**
   ```powershell
   cd api-python
   func azure functionapp publish familyalbum-faces-api --python
   ```

2. **Deploy Node.js API:**
   - Automatic via Azure Static Web Apps CI/CD
   - Or manually: `swa deploy`

3. **Test Endpoints:**
   ```powershell
   # Check training status
   curl https://your-site.azurestaticapps.net/api/faces/check-training-status
   
   # Seed with baseline parameters
   curl -X POST https://your-site.azurestaticapps.net/api/faces/seed \
     -H "Content-Type: application/json" \
     -d '{"limit":100,"maxPerPerson":5}'
   
   # Train with quick mode
   curl -X POST https://your-site.azurestaticapps.net/api/faces/train \
     -H "Content-Type: application/json" \
     -d '{"quickTrain":true}'
   ```

## Cost Optimization

### Baseline Training
- Processes ~5 faces per person
- For 50 people: 250 faces
- Processing time: ~10-30 seconds
- **Cost: FREE** (within Azure free tier)

### Full Training
- Uses logarithmic sampling
- For 50 people with 100 faces each:
  - Without sampling: 5,000 faces
  - With sampling: ~2,500 faces (50% reduction)
- Processing time: ~1-5 minutes
- **Cost: FREE** (within Azure free tier for most users)

## Benefits

1. **Fast Initial Results**
   - Users get face recognition working in seconds
   - No need to wait for full training to start testing

2. **Progressive Enhancement**
   - Baseline provides good accuracy
   - Full training improves accuracy further
   - Users can iterate multiple times

3. **User Control**
   - Cancel button prevents frustration
   - Clear messaging about training phase
   - Can abort and retry anytime

4. **Cost Efficient**
   - Baseline uses minimal resources
   - Full training still uses smart sampling
   - Both typically FREE within Azure limits

## Documentation

See detailed documentation:
- **docs/INCREMENTAL_TRAINING.md** - Complete guide to incremental training
- **docs/SMART_SAMPLING_ALGORITHM.md** - Logarithmic sampling algorithm
- **docs/AUTO_TRAINING_SYSTEM.md** - Automatic training triggers

## Next Steps

After deployment:
1. Test baseline training with real data
2. Verify cancel button works as expected
3. Monitor logs for training modes
4. Check PersonEncodings table grows correctly
5. Validate face recognition accuracy improves with full training
