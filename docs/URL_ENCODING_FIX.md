# URL Encoding Fix for Image Display

## Problem Summary
Pictures were not showing up when clicked due to a URL encoding issue. The filenames stored in the database contained URL-encoded characters (e.g., `PA130060%20(2).JPG` with `%20` for space, `%27` for apostrophe), and the API was encoding them again, creating double-encoding that prevented images from loading.

## Root Cause Analysis

### Database State
The database contains filenames with URL-encoded characters:
- `Devorah%27s Wedding` (apostrophe encoded as `%27`)
- `PA130060%20(2).JPG` (space encoded as `%20`)
- `Folder%5CFile.jpg` (backslash encoded as `%5C`)

### Previous API Behavior
The API in `api/media/index.js` was directly encoding these paths:
```javascript
// Old code
blobPath = blobPath.replace(/\\/g, '/').replace(/\/+/g, '/');
PBlobUrl: `/api/media/${encodeURIComponent(blobPath)}`
```

This created double-encoding:
1. Database value: `Devorah%27s Wedding/PA130060%20(2).JPG`
2. After `encodeURIComponent()`: `Devorah%2527s%20Wedding%2FPA130060%2520(2).JPG`
   - `%27` became `%2527` (the `%` was encoded to `%25`)
   - `%20` became `%2520`
3. When browser decodes once: `Devorah%27s Wedding/PA130060%20(2).JPG`
4. This doesn't match the actual blob: `Devorah's Wedding/PA130060 (2).JPG` ❌

## Solution

### Code Changes
Modified the API to decode paths before re-encoding them:

```javascript
// New code in api/media/index.js (lines 238-248)
// Decode the blob path in case it contains URL-encoded characters from the database
try {
    blobPath = decodeURIComponent(blobPath);
} catch (e) {
    // If decoding fails, the path is not encoded, so use it as-is
    context.log(`Could not decode path: ${blobPath}`, e.message);
}

// Normalize slashes and remove duplicate slashes (after decoding)
blobPath = blobPath.replace(/\\/g, '/').replace(/\/+/g, '/');
```

### How It Works Now
1. Database value: `Devorah%27s Wedding/PA130060%20(2).JPG`
2. After `decodeURIComponent()`: `Devorah's Wedding/PA130060 (2).JPG`
3. After slash normalization: `Devorah's Wedding/PA130060 (2).JPG`
4. After `encodeURIComponent()`: `Devorah's%20Wedding%2FPA130060%20(2).JPG`
5. When browser decodes once: `Devorah's Wedding/PA130060 (2).JPG` ✅

The path now matches the actual blob storage path!

## Key Benefits

1. **Handles Both Encoded and Unencoded Database Values**
   - If the database has encoded values: decodes them first
   - If the database has plain values: decode has no effect

2. **Maintains Backward Compatibility**
   - Works with existing database records
   - No need to update the database
   - Error handling ensures robustness

3. **Correct Slash Normalization**
   - Backslashes (`\` or `%5C`) are normalized to forward slashes after decoding
   - Azure Blob Storage uses forward slashes

## Test Coverage

Created comprehensive test suite in `scripts/test-url-encoding-fix.js`:

### Test Scenarios
1. ✅ Normal filename without URL encoding in database
2. ✅ Filename with URL encoding already in database (spaces)
3. ✅ Directory name with apostrophe encoded in database
4. ✅ Mixed encoding - directory and filename both have special chars
5. ✅ Filename with backslash AND URL encoding

All tests verify:
- Correct URL generation
- Correct blob path after browser decoding
- No double-encoding

### Existing Tests
All existing tests still pass:
- ✅ `scripts/test-path-normalization.js` (5/5 tests)
- ✅ ESLint validation
- ✅ Next.js build
- ✅ No security vulnerabilities

## Files Modified

1. **api/media/index.js**
   - Added `decodeURIComponent()` before slash normalization
   - Added try-catch for robustness
   - Updated comments

2. **scripts/test-url-encoding-fix.js** (new file)
   - Comprehensive test suite for URL encoding scenarios
   - Tests both single and double encoding cases

## Impact

### Before Fix
- ❌ Pictures with spaces in filenames: failed to load
- ❌ Pictures with apostrophes in folder names: failed to load
- ❌ Pictures with other special characters: failed to load

### After Fix
- ✅ All pictures load correctly regardless of special characters
- ✅ Backward compatible with existing database records
- ✅ Handles both encoded and unencoded filenames

## Deployment

The fix is ready to deploy:
1. Changes are minimal and surgical
2. All tests pass
3. Build succeeds
4. No security vulnerabilities
5. No breaking changes

Simply deploy the updated code to Azure Static Web App, and the image loading issue will be resolved.

## Related Documentation

- [FIX_IMAGE_LOADING_ERROR.md](./FIX_IMAGE_LOADING_ERROR.md) - Previous path normalization fix
- [DEVORAH_WEDDING_PATH_FIX.md](./DEVORAH_WEDDING_PATH_FIX.md) - Database path consistency issue
- `scripts/test-path-normalization.js` - Path normalization tests
- `scripts/test-url-encoding-fix.js` - URL encoding tests
