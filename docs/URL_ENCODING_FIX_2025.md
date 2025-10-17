# Image Loading Error - URL Encoding Fix

## Problem
Images were not loading in the deployed application with 404 errors:
```
GET /api/media/Devorah's%20Wedding/Devorah%27s%20Wedding%20025.jpg 404 (Not Found)
```

## Root Cause
The media API was constructing URLs without properly encoding the path segments. When the database contained filenames with special characters (apostrophes, spaces, ampersands, etc.), the URLs were malformed:

**Before Fix:**
```javascript
// api/media/index.js line 253-259 (old)
blobPath = blobPath.replace(/\\/g, '/');

// Don't encode the blobPath - it's already URL-encoded in the database to match blob storage
return {
    ...item,
    PBlobUrl: `/api/media/${blobPath}`,
    PThumbnailUrl: `/api/media/${blobPath}`
};
```

This resulted in URLs like:
- `/api/media/Devorah's Wedding/Devorah's Wedding 025.jpg` (unencoded apostrophes)

When these URLs were used in the browser, they were partially encoded by the browser itself, creating inconsistent encoding:
- `/api/media/Devorah's%20Wedding/Devorah%27s%20Wedding%20025.jpg` (mixed encoding)

But the Azure Functions runtime couldn't properly match the route because the apostrophe in the first segment wasn't encoded.

## Solution
Encode each path segment separately while preserving the forward slashes:

**After Fix:**
```javascript
// api/media/index.js lines 251-261 (new)
// Normalize slashes (convert backslash to forward slash)
blobPath = blobPath.replace(/\\/g, '/');

// Encode the path for use in URLs
// Encode each path segment separately to preserve the forward slashes
const encodedPath = blobPath.split('/').map(segment => encodeURIComponent(segment)).join('/');

return {
    ...item,
    PBlobUrl: `/api/media/${encodedPath}`,
    PThumbnailUrl: `/api/media/${encodedPath}`
};
```

This generates properly encoded URLs like:
- `/api/media/Devorah%27s%20Wedding/Devorah%27s%20Wedding%20025.jpg`

### Why Split and Encode Separately?
- `encodeURIComponent("Devorah's Wedding/file.jpg")` → `Devorah%27s%20Wedding%2Ffile.jpg` ❌ (encodes the slash)
- `"Devorah's Wedding".split('/').map(encodeURIComponent).join('/')` → `Devorah%27s%20Wedding/file.jpg` ✓ (preserves the slash)

The Azure Functions route is defined as `media/{*filename}` which expects forward slashes to separate path segments, not encoded `%2F`.

## How the Fix Works

1. **Database Storage**: Filenames stored with actual characters (apostrophes, spaces, etc.)
   - `PFileDirectory`: `"Devorah's Wedding"`
   - `PFileName`: `"Devorah's Wedding 025.jpg"`

2. **Path Construction**: API combines directory and filename
   - `blobPath = "Devorah's Wedding/Devorah's Wedding 025.jpg"`

3. **URL Encoding**: Each segment encoded separately
   - Split: `["Devorah's Wedding", "Devorah's Wedding 025.jpg"]`
   - Encode: `["Devorah%27s%20Wedding", "Devorah%27s%20Wedding%20025.jpg"]`
   - Join: `"Devorah%27s%20Wedding/Devorah%27s%20Wedding%20025.jpg"`
   - URL: `/api/media/Devorah%27s%20Wedding/Devorah%27s%20Wedding%20025.jpg`

4. **API Reception**: Azure Functions receives and decodes
   - Route matches: `media/{*filename}` where `filename = "Devorah%27s%20Wedding/Devorah%27s%20Wedding%20025.jpg"`
   - Decoded: `"Devorah's Wedding/Devorah's Wedding 025.jpg"` (lines 19-24 of index.js)
   - Blob lookup: Uses decoded path to find blob in storage

## Files Modified
- `api/media/index.js` - Fixed URL encoding logic

## Files Created
- `scripts/test-url-encoding.js` - Test script to verify the fix with various special characters

## Testing
Run the test script to verify encoding works correctly:
```powershell
node scripts/test-url-encoding.js
```

Expected output:
```
✓ All tests passed!
```

## Deployment
The fix will be automatically deployed when pushed to the main branch via GitHub Actions workflow.

## Verification Steps
After deployment:
1. Open the deployed app: https://lively-glacier-02a77180f.2.azurestaticapps.net
2. Navigate to albums with special characters (e.g., "Devorah's Wedding")
3. Click on any image
4. Image should load without 404 errors
5. Check browser console - no errors should appear

## Related Issues
- Similar to the backslash issue fixed in `docs/FIX_IMAGE_LOADING_ERROR.md`
- This fix handles special characters (apostrophes, spaces, ampersands, parentheses, etc.)
- Maintains compatibility with the existing blob storage structure

## Date
October 17, 2025
