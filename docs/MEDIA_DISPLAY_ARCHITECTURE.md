# How Pictures Are Displayed in Media Detail Page

## Overview
Pictures are successfully displayed in the media detail page through a **proxy API endpoint** architecture, even though the database `PBlobUrl` column is NULL.

## Flow

### 1. Database State
- **Pictures table:** Contains 9,715 media records
- **PBlobUrl column:** ALL NULL (not stored)
- **PThumbnailUrl column:** ALL NULL (on-demand generation)

### 2. API Response (Line 711 of api/media/index.js)
When the API returns media list, it constructs URLs dynamically:

```javascript
return {
    ...item,
    PBlobUrl: `/api/media/${blobPath}`,  // ← Proxied through API
    PThumbnailUrl: thumbnailUrl,          // ← Stored or on-demand
    TaggedPeople: orderedTagged,
    Event: eventForItem
};
```

**The API does NOT use the database's PBlobUrl** - it generates the URL from the filename.

### 3. Frontend Display (MediaDetailModal.tsx, Line 411)
The component receives the API response with `/api/media/{filename}` URLs:

```tsx
<img 
    src={media.PBlobUrl}  // Receives: "/api/media/Events\ES BnotMitzvah\IMG_2583.JPG"
    alt={media.PDescription || media.PFileName}
/>
```

### 4. API Handling (api/media/index.js)
When the browser requests `/api/media/{filename}`:
- The API extracts the filename from the URL
- Fetches the file from Azure Blob Storage
- Returns it to the browser

## Why This Works

✅ **Advantages of this proxy architecture:**
- Centralized media serving through the API
- Better control over access and caching
- Easy to add authentication/authorization
- Can transform content before serving (compression, resizing)
- Works even if blob URLs change

❌ **Why the database PBlobUrl is NULL:**
- The migration from SQLite to Azure SQL populated the Pictures table
- But the blob upload and URL recording process was never completed
- This column is currently unused - the API generates URLs dynamically

## The 2 PPeopleList Inconsistencies

The pictures you asked about ARE displayed correctly:
1. **Events\ES BnotMitzvah\IMG_2583.JPG** - ✅ Displays fine
2. **Family Pictures\20181228_200909.jpg** - ✅ Displays fine

The PPeopleList/NamePhoto mismatch is a **data consistency issue**, not a display issue:
- PPeopleList: `507,281`
- NamePhoto has: `462` (missing from PPeopleList)

This means the photo tagging is incomplete - person/event ID 462 was tagged in NamePhoto but PPeopleList wasn't updated.

## Recommendations

### Current State: ✅ Working
The system currently works without populating PBlobUrl because of the proxy architecture.

### Optional Optimization:
If you want to store direct blob URLs in the database (for future use or API flexibility), you would:
1. Update the database with: `UPDATE Pictures SET PBlobUrl = 'https://familyalbumprodstorageacctd4m3.blob.core.windows.net/photos/' + REPLACE(REPLACE(PFileName, '\', '%5C'), ' ', '%20')`
2. Then optionally update the API to use `PBlobUrl` from database instead of constructing it

But this is NOT required for the current system to work.

