# Image Loading Error - Mixed Blob Storage Naming Fix

## Problem
Images were failing to load with 500 Internal Server Errors:
```
GET /api/media/Devorah's%20Wedding/PA130048.JPG 500 (Internal Server Error)
```

## Root Cause Discovery

Using Azure CLI, we discovered that blob storage has **inconsistent naming conventions**:

### URL-Encoded Blob Names (11 files):
```
Devorah's Wedding/Devorah%27s%20Wedding%20003.jpg
Devorah's Wedding/Devorah%27s%20Wedding%20004.jpg
Devorah's Wedding/Devorah%27s%20Wedding%20005.jpg
...
```

### Plain Blob Names (41 files):
```
Devorah's Wedding/PA130048.JPG
Devorah's Wedding/PA130047.JPG
Devorah's Wedding/PA130050.JPG
...
```

### The Problem
1. The directory is stored with actual apostrophe: `Devorah's Wedding/`
2. Some files have URL-encoded names in their filename portion
3. Most files have plain names
4. The API was encoding all paths uniformly, causing mismatches

### Example Flow:
```
Browser request:
  → /api/media/Devorah%27s%20Wedding/PA130048.JPG

API decodes URL:
  → filename = "Devorah's Wedding/PA130048.JPG"

Previous behavior (would fail):
  → Construct URL for response: /api/media/Devorah%27s%20Wedding/PA130048.JPG
  → But blob is stored as: Devorah's Wedding/PA130048.JPG (plain)
  → 500 Error: Blob not found

Current behavior (works):
  → Try plain name first: Devorah's Wedding/PA130048.JPG ✓
  → If not found, try encoded filename: Devorah's Wedding/PA130048.JPG
  → Returns blob successfully
```

## Solution

Modified `api/media/index.js` to handle both naming conventions:

```javascript
// Check if the blob exists with the plain name first
let blobFound = await blobExists(blobPath);

// If not found, try with URL-encoded filename (some blobs were uploaded with encoded names)
if (!blobFound) {
    const pathParts = blobPath.split('/');
    const encodedFilename = pathParts.slice(0, -1)
        .concat(encodeURIComponent(pathParts[pathParts.length - 1]))
        .join('/');
    if (await blobExists(encodedFilename)) {
        blobPath = encodedFilename;
        blobFound = true;
    }
}

if (!blobFound) {
    return 404;
}
```

### Why This Works
1. **First try**: Look for blob with plain name (most common case)
   - `Devorah's Wedding/PA130048.JPG`
2. **Fallback**: If not found, encode just the filename portion
   - `Devorah's Wedding/PA130048.JPG` (same in this case, no special chars in filename)
3. **For encoded blobs**: Finds `Devorah's Wedding/Devorah%27s%20Wedding%20003.jpg`

## Files Modified
- `api/media/index.js` - Added fallback logic for blob lookup

## Files Created
- `scripts/check-blob-storage.ps1` - Analyzes blob storage naming patterns
- `docs/IMAGE_LOADING_MIXED_NAMING_FIX.md` - This documentation

## Why Did This Happen?

The blob storage has mixed naming because files were uploaded at different times with different upload scripts:

1. **Earlier uploads**: Some filenames were URL-encoded during upload
2. **Later uploads**: Files were uploaded with plain names
3. **Directory names**: Always stored with actual characters (apostrophes, spaces)

## Testing

Run the blob storage analysis script:
```powershell
.\scripts\check-blob-storage.ps1
```

This shows which files have URL-encoded names vs plain names.

## Verification Steps

After deployment (2-3 minutes):
1. Open https://lively-glacier-02a77180f.2.azurestaticapps.net
2. Navigate to "Devorah's Wedding" album
3. Click on various images:
   - `PA130048.JPG` (plain name in blob storage) - should work ✓
   - `Devorah's Wedding 003.jpg` (encoded name in blob storage) - should work ✓
4. Check browser console - no 500 errors

## Future Recommendations

To avoid this issue in the future:

1. **Normalize blob names**: All new uploads should use consistent naming (preferably plain names)
2. **Rename existing blobs**: Consider running a script to rename all URL-encoded blobs to plain names
3. **Upload scripts**: Update upload scripts to use plain names consistently

### Optional Cleanup Script (Future)
```powershell
# Rename all URL-encoded blobs to plain names
# This would make the blob storage consistent
# Run after testing to ensure everything works
```

## Related Issues
- Initial URL encoding fix in commit `cada206`
- Blob storage was created with mixed naming from different migration scripts

## Date
October 17, 2025
