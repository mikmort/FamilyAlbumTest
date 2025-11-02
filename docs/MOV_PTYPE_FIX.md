# MOV Files Showing as Pictures - Fixed

## Issue
MOV files like `Events/Thanksgiving/Thanksgiving 2012/MVI_5304.MOV` were showing as picture thumbnails instead of video thumbnails in the UI.

## Root Cause
The MOV files in the database had **`PType = 3`**, which is an invalid value according to the schema. The schema only defines:
- `PType = 1` for images
- `PType = 2` for videos

The UI checks for `PType === 2` to display video indicators and generate video thumbnails. Files with `PType = 3` were treated as images by default.

## Files Affected
- **75 MOV files** had `PType = 3`
- All these files had valid video durations (`PTime`) and were actual video files
- Most were in:
  - `Events/Thanksgiving/Thanksgiving 2012/`
  - `Events/ES BnotMitzvah/`
  - `On Location/` folders

## Fix Applied
Updated all video files (MOV, MP4, AVI) with `PType = 3` to `PType = 2`:

```sql
UPDATE Pictures 
SET PType = 2
WHERE PType = 3 
AND (LOWER(PFileName) LIKE '%.mov' 
     OR LOWER(PFileName) LIKE '%.mp4' 
     OR LOWER(PFileName) LIKE '%.avi');
```

**Result:** 75 files updated successfully

## Verification
- ✅ All MOV files now have `PType = 2`
- ✅ `MVI_5304.MOV` confirmed with `PType = 2`
- ✅ No video files remain with incorrect `PType` values
- ✅ All 141 video files in database now have correct `PType = 2`

## What Happens Next
1. **Video Indicators:** The play button overlay will now appear on these thumbnails in the UI
2. **Thumbnail Generation:** Video thumbnails will be automatically generated on first view using FFmpeg
3. **Video Playback:** Files will play as videos with proper controls

## Note on Thumbnails
These MOV files currently have `PThumbnailUrl = null`. This is normal - the system will:
1. Extract a frame from the video using FFmpeg when first viewed
2. Generate and upload a thumbnail to Azure Blob Storage
3. Cache the thumbnail URL in the database for future use

## Prevention
The root cause of why these files were imported with `PType = 3` should be investigated. Check:
- Upload/import scripts
- Any legacy data migration code
- The original data source that set `PType = 3`

The schema constraint `CHECK (PType IN (1, 2))` should prevent future occurrences.

## Files Created
- `scripts/fix-mov-ptype.js` - JavaScript fix script (executed)
- `scripts/fix-mov-ptype.sql` - SQL fix script (reference)
- `scripts/check-mov-ptype.js` - Diagnostic script to check MOV file PType values
