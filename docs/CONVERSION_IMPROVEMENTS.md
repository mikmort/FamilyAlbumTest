# Video Conversion Script Improvements

## Issues Fixed

### 1. Upload Error: `uploadFile is not a function`
**Problem**: Used `getBlobClient()` which returns generic `BlobClient` without `uploadFile()` method.

**Solution**: Changed to `getBlockBlobClient()` which returns `BlockBlobClient` with proper upload methods.

### 2. Download Timeout: "The operation was aborted"
**Problem**: Large video files (1+ GB) timing out during download from blob storage.

**Solution**: 
- Added 10-minute timeout to prevent indefinite hangs
- Added retry logic (up to 3 attempts) for network errors
- Added 5-second delay between retries

### 3. FFmpeg Crashes: "FFmpeg exited with code 4294967294"
**Problem**: FFmpeg failing on certain video files, cryptic error codes.

**Solution**:
- Capture FFmpeg stderr output
- Display last 5 lines of error in failure message
- Verify input/output files exist before proceeding
- Better error messages for debugging

### 4. File Lock Errors: "EBUSY: resource busy or locked"
**Problem**: Windows keeping file handles open after FFmpeg completes, causing unlink to fail.

**Solution**:
- Created `safeUnlink()` helper function
- Wait 1 second before attempting delete (allows handles to release)
- Retry up to 3 times with 2-second delays
- Graceful warning instead of crashing if cleanup fails

## New Features

### Automatic Retry Logic
- Network errors (aborted, timeout) automatically retry up to 3 times
- 5-second delay between retry attempts
- Progress messages show retry attempts

### Better Progress Tracking
- Shows which files are being retried
- Summary includes list of failed files with error messages
- Clear indication if script should be re-run

### Safer Cleanup
- Files are cleaned up even if errors occur
- Non-critical cleanup warnings don't stop processing
- Temp files won't accumulate if script is interrupted

## Running the Improved Script

```powershell
cd api
$env:AZURE_STORAGE_KEY = "your-storage-key"
node ..\scripts\convert-blob-mov-to-mp4.js
```

The script will now:
- ✅ Skip files already converted (MP4 exists)
- ✅ Retry network failures automatically
- ✅ Handle large files (1+ GB) without timeout
- ✅ Clean up temp files even on errors
- ✅ Show detailed summary with failed files
- ✅ Can be safely re-run to retry failures

## Expected Behavior

### Success Case
```
🎬 Converting: Events/ES BnotMitzvah/MVI_5735.MOV
   ⬇️  Downloading...
   🔄 Converting to MP4...
   ⬆️  Uploading MP4...
   ✅ Success! 293.94MB → 24.33MB (91.7% smaller)
```

### Retry Case
```
🎬 Converting: Events/ES BnotMitzvah/MVI_5741.MOV
   ⬇️  Downloading...
   ❌ Failed: The operation was aborted
   🔄 Retrying (attempt 2/3)...
   ⬇️  Downloading...
   🔄 Converting to MP4...
   ⬆️  Uploading MP4...
   ✅ Success! 150.21MB → 45.67MB (69.6% smaller)
```

### Skip Case
```
🎬 Converting: Events/ES BnotMitzvah/MVI_5712.MOV
   ⏭️  MP4 already exists, skipping
```

## Troubleshooting

If files continue to fail after 3 retries:
1. Check if the MOV file is corrupted
2. Try downloading the MOV file manually to verify
3. Check FFmpeg can open the file: `ffmpeg -i filename.MOV`
4. The script can be safely re-run - it skips already-converted files
