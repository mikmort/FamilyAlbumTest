# Face Training Resume Feature

## Overview

The face training system now supports checkpoint/resume functionality, allowing training sessions to be interrupted and resumed later without losing progress.

## Implementation

### Core Changes

1. **Checkpoint Storage**: Uses `localStorage` with key `faceTrainingCheckpoint`
2. **Auto-save**: Checkpoint saved every 10 photos processed
3. **Resume Detection**: Checks for checkpoint on component mount
4. **UI Indicators**: Banner displays progress and offers resume/clear options

### Checkpoint Data Structure

```typescript
{
  processedPhotos: string[],      // Array of PFileName already processed
  successCount: number,            // Successful embeddings saved
  errorCount: number,              // Failed processing attempts
  totalPhotos: number,             // Total photos in training set
  totalPeople: number,             // Number of unique people
  maxPerPerson: number | undefined,// 5 for baseline, undefined for full
  isQuickTrain: boolean,           // Whether this is baseline training
  timestamp: string                // ISO timestamp of last save
}
```

### User Experience

1. **Normal Training**: Click "Train Now" → processes all photos → clears checkpoint on completion
2. **Interruption**: User refreshes page or navigates away → checkpoint preserved
3. **Resume**: On return, yellow banner shows progress with two options:
   - "▶️ Resume Training" - continues from where it left off
   - "🗑️ Clear & Start Over" - removes checkpoint and starts fresh

### Key Features

- **Preserves baseline training**: First run still processes 5 photos per person
- **Progress tracking**: Shows X of Y photos processed
- **Error resilience**: Maintains success/error counts across sessions
- **Smart filtering**: Skips already-processed photos on resume
- **Clean completion**: Auto-clears checkpoint when training completes successfully

## Technical Details

### Modified Functions

- `trainFaces(resumeFromCheckpoint: boolean = false)`: Accepts resume parameter
- `checkForIncompleteSession()`: Checks localStorage instead of deleted API endpoint

### State Management

- `incompleteSession`: Holds checkpoint data for UI display
- `processedPhotos`: Set tracking filenames already processed
- Auto-clears on successful completion via `setIncompleteSession(null)`

### User Flow

```
Start Training
    ↓
Load Models (if needed)
    ↓
Check for Checkpoint
    ↓
Resume? → Yes → Load checkpoint → Filter processed photos
    ↓
    No → Clear old checkpoint
    ↓
Process Photos (save checkpoint every 10)
    ↓
Complete → Clear checkpoint & state
```

## Testing

### Manual Test Scenarios

1. **Normal Flow**:
   - Start training, let it complete
   - Verify checkpoint cleared
   - Verify no resume banner appears

2. **Interrupt & Resume**:
   - Start training, refresh page after 20+ photos
   - Verify resume banner appears with correct count
   - Click "Resume Training"
   - Verify it continues where it left off
   - Verify completion clears checkpoint

3. **Clear Checkpoint**:
   - Start training, interrupt
   - Click "Clear & Start Over"
   - Verify banner disappears
   - Verify localStorage cleared

## Files Modified

- `components/AdminSettings.tsx`: Core implementation
  - Added `resumeFromCheckpoint` parameter
  - Added checkpoint save/load logic
  - Added resume UI banner
  - Modified `checkForIncompleteSession()` to use localStorage

## Commit History

- Commit `79c7ed9`: "Add checkpoint resume for face training"
- Previous: `4bb9a64` (baseline + full training implementation)

## Related Documentation

- `docs/AZURE_FACE_API_RESTRICTIONS.md` - Why we use face-api.js
- `docs/RBAC_SYSTEM.md` - Access control for training features
- `.github/copilot-instructions.md` - Development guidelines
