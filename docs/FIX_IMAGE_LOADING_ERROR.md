# Fix for Image Loading Error with Backslashes in Paths

## Problem
When clicking on a picture in the gallery, the application threw a 500 error:
```
GET https://lively-glacier-02a77180f.2.azurestaticapps.net/api/media/Devorah's%20Wedding%5CPA130060.JPG
net::ERR_ABORTED 500 (Internal Server Error)
```

The URL contained `%5C` (URL-encoded backslash `\`) instead of `%2F` (forward slash `/`).

## Root Cause
1. **Database Migration**: When the database was migrated from SQLite, Windows-style file paths with backslashes (e.g., `Devorah's Wedding\PA130060.JPG`) were preserved in the `PFileName` and `PFileDirectory` columns.

2. **Component Architecture Issue**: The `MediaDetailModal` component was attempting to:
   - Fetch JSON data from `/api/media/{filename}` endpoint
   - However, this endpoint returns blob content (the actual image), not JSON
   - The component was trying to construct its own URLs using raw filenames that might contain backslashes

## Solution
The fix involved restructuring how the `MediaDetailModal` component works:

### Changes Made

1. **MediaDetailModal.tsx**
   - Changed from accepting a `filename: string` prop to accepting a `media: MediaItem` object
   - Removed the useEffect and fetch logic that tried to get JSON from the blob endpoint
   - Now uses `media.PBlobUrl` directly, which is pre-normalized by the API
   - Removed dependencies on people/event data that weren't available

2. **ThumbnailGallery.tsx**
   - Updated `onMediaClick` callback to pass the full `MediaItem` object instead of just the filename
   - This ensures the modal receives all necessary data including the normalized URL

3. **page.tsx**
   - Changed `selectedMedia` state from `string | null` to `MediaItem | null`
   - Updated the modal instantiation to pass the media object

### Why This Works

The media list API (`GET /api/media`) already handles path normalization correctly:
```javascript
// In api/media/index.js, lines 238-239
blobPath = blobPath.replace(/\\/g, '/').replace(/\/+/g, '/');
// Then encodes the normalized path:
PBlobUrl: `/api/media/${encodeURIComponent(blobPath)}`
```

This means:
- Paths like `Devorah's Wedding\PA130060.JPG` become `Devorah's Wedding/PA130060.JPG`
- When URL-encoded, they use `%2F` (forward slash) not `%5C` (backslash)
- The blob storage can find the files correctly (Azure Blob Storage uses forward slashes)

By using the pre-normalized `PBlobUrl` from the API response, the modal avoids creating malformed URLs.

## Verification

The fix has been verified with:
1. ✅ ESLint passes (only warnings about image optimization, which are non-blocking)
2. ✅ Next.js build succeeds
3. ✅ Comprehensive path normalization tests (`scripts/test-path-normalization.js`) all pass

## Testing the Fix

To test that the fix works with your actual data:

1. Deploy the updated code to your Azure Static Web App
2. Navigate to the gallery
3. Click on any picture (especially ones from "Devorah's Wedding" or other folders with backslashes in the database)
4. The modal should open showing the full-size image without any 500 errors

## Additional Notes

- The API already handles backslashes correctly when receiving GET requests with filenames (line 30 of `api/media/index.js`)
- If you see similar errors, they would likely be from old database entries or cached URLs
- The edit/save functionality in the modal is currently disabled (shows an alert) and can be implemented later with a proper PUT endpoint
