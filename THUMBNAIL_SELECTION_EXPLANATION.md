# How Thumbnails Are Selected When You Select a Person

## Overview
When you select a person in the Gallery, the app displays thumbnails for all photos that person appears in. Here's the complete flow:

---

## Step 1: User Selects a Person (Frontend)

### File: `components/PeopleSelector.tsx`
- User clicks on a person in the People Selector interface
- The person's ID (number) is added to `selectedPeople` array
- Example: If you click "Adam Hodges", their ID (e.g., 195) is added

### File: `components/ThumbnailGallery.tsx`
- When `selectedPeople` changes, a `useEffect` hook triggers
- Calls `fetchMedia()` with the selected person IDs

---

## Step 2: Query is Built (Frontend)

### File: `components/ThumbnailGallery.tsx` - `fetchMedia()` function

The frontend constructs a URL with query parameters:

```
/api/media?peopleIds=195,553,318&exclusiveFilter=false&sortOrder=desc
```

Parameters:
- `peopleIds`: Comma-separated list of selected person IDs (195, 553, 318)
- `exclusiveFilter`: 
  - `true` = Show photos with ALL selected people
  - `false` = Show photos with ANY of the selected people (default)
- `sortOrder`: `asc` or `desc` (default: `desc`)
- `noPeople`: Optional - show photos with no people tagged
- `eventId`: Optional - filter by a specific event

---

## Step 3: Database Query (Backend API)

### File: `api/media/index.js` - Lines 468-530

The API receives the query and constructs a SQL query to find matching photos.

#### Parse Query Parameters (Line 468):
```javascript
const peopleIds = req.query.peopleIds ? req.query.peopleIds.split(',').map(id => parseInt(id)) : [];
const exclusiveFilter = req.query.exclusiveFilter === 'true';
```

#### Build WHERE Clause (Lines 485-520):

**If EXCLUSIVE Filter (must have ALL selected people):**
```sql
EXISTS (SELECT 1 FROM dbo.NamePhoto np 
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE np.npFileName = p.PFileName 
        AND np.npID = @person0
        AND ne.neType = 'N')
AND
EXISTS (SELECT 1 FROM dbo.NamePhoto np 
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE np.npFileName = p.PFileName 
        AND np.npID = @person1
        AND ne.neType = 'N')
...
```

**If INCLUSIVE Filter (has ANY selected people):**
```sql
EXISTS (SELECT 1 FROM dbo.NamePhoto np 
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE np.npFileName = p.PFileName 
        AND np.npID IN (@person0, @person1, @person2, ...)
        AND ne.neType = 'N')
```

#### Full Media Query:
```javascript
SELECT DISTINCT p.*
FROM dbo.Pictures p
WHERE 
    -- People filter (built above)
    EXISTS (SELECT 1 FROM dbo.NamePhoto np ...)
ORDER BY p.PYear DESC, p.PMonth DESC, p.PFileName DESC
```

**Result:** Returns all `Pictures` records matching the filter

---

## Step 4: Transform Results (Backend API)

### File: `api/media/index.js` - Lines 680-740

For each returned picture, the API transforms it:

```javascript
return {
    ...item,  // Original DB fields (PFileName, PYear, PMonth, PPeopleList, etc)
    PBlobUrl: `/api/media/${blobPath}`,
    PThumbnailUrl: `/api/media/${blobPath}?thumbnail=true`,  // THIS IS KEY!
    TaggedPeople: orderedTagged,
    Event: eventForItem
};
```

**Key:** `PThumbnailUrl` is set to:
```
/api/media/Events%2FWhistler%2FDSC04780%20(1).JPG?thumbnail=true
```

This is NOT the actual thumbnail image. It's a **URL that will be called later** to generate/retrieve the thumbnail.

---

## Step 5: Display Thumbnails (Frontend)

### File: `components/ThumbnailGallery.tsx` - Lines 103-120

```tsx
<img
    src={media.PThumbnailUrl}  // e.g. /api/media/...?thumbnail=true
    alt="..."
    onClick={() => onMediaClick(media)}
/>
```

The browser renders `<img>` tags with the thumbnail URLs from Step 4.

---

## Step 6: On-Demand Thumbnail Generation (Backend)

### File: `api/media/index.js` - Lines 197-400

When the browser loads an `<img>` with `?thumbnail=true`, the API is called:

**GET Request:**
```
GET /api/media/Events%2FWhistler%2FDSC04780%20(1).JPG?thumbnail=true
```

**Processing (Lines 264-350):**

1. **Check if thumbnail already exists** (in Azure Blob Storage under `thumbnails/` folder)
   ```javascript
   const thumbnailPath = `thumbnails/${foundFilenamePart}`;
   const thumbnailExists = await blobExists(thumbnailPath);
   ```

2. **If thumbnail exists:**
   - Check its size
   - If < 100 bytes (placeholder), regenerate it
   - Otherwise, return the existing thumbnail

3. **If thumbnail doesn't exist OR needs regeneration:**

   **For IMAGES (JPG, PNG, etc):**
   - Download original from blob storage
   - Resize using `sharp` library:
     ```javascript
     finalThumbnail = await sharp(imageBuffer)
         .resize(300, null, {
             fit: 'inside',
             withoutEnlargement: true
         })
         .jpeg({ quality: 80 })
         .toBuffer();
     ```
   - Upload to `thumbnails/` folder
   - Return the thumbnail

   **For VIDEOS (MP4, MOV, WMV, etc):**
   - Download video file from blob storage
   - Extract first frame using FFmpeg
   - Resize extracted frame using sharp
   - Upload to `thumbnails/` folder
   - Return the frame as image

4. **Return the thumbnail image** with proper headers:
   ```javascript
   context.res = {
       status: 200,
       headers: { 'Content-Type': 'image/jpeg' },
       body: thumbnailBuffer
   };
   ```

---

## Summary: Complete Flow

```
User Selects Person (ID 195)
         ↓
ThumbnailGallery queries: /api/media?peopleIds=195
         ↓
API finds all photos with person 195 in NamePhoto table
         ↓
For each photo, API returns:
   - PFileName, PYear, PMonth, PPeopleList, ...
   - PThumbnailUrl: /api/media/{path}?thumbnail=true
         ↓
Frontend renders <img src="PThumbnailUrl" />
         ↓
Browser requests thumbnail via /api/media/{path}?thumbnail=true
         ↓
API checks if thumbnail exists in Azure Blob Storage
         ↓
If not, API:
   - Downloads original from blob storage
   - For images: Resizes with sharp
   - For videos: Extracts frame with ffmpeg, then resizes
   - Uploads to thumbnails/ folder
   - Returns the thumbnail
         ↓
Browser displays thumbnail in gallery
```

---

## Key Database Tables

### `dbo.Pictures` (Photos/Videos metadata)
```
PFileName      | Text     | e.g., "Events\Whistler\DSC04780 (1).JPG"
PFileDirectory | Text     | e.g., "Events\Whistler"
PYear          | Int      | 2024
PMonth         | Int      | 7
PPeopleList    | Text     | "195,553,318,551,507,281,462,425,552"
PType          | Int      | 1=Image, 2=Video
```

### `dbo.NamePhoto` (Many-to-many: People/Events ↔ Photos)
```
npID       | Int  | Person or Event ID (references NameEvent.ID)
npFileName | Text | Photo filename (references Pictures.PFileName)
```

### `dbo.NameEvent` (People and Events)
```
ID       | Int   | Unique identifier
neName   | Text  | Person name or Event name
neType   | Char  | 'N'=Person, 'E'=Event
```

---

## Performance Optimizations

1. **Thumbnails are cached** - Generated once, reused many times
2. **On-demand generation** - Only created when requested
3. **Batch queries** - Single SQL query returns all matching photos
4. **Lazy loading** - Frontend only loads visible thumbnails
5. **Size checks** - Detects corrupted/placeholder thumbnails and regenerates

---

## Example: Finding Photos of Adam Hodges

```
User clicks: Adam Hodges (ID: 195)
    ↓
Query: /api/media?peopleIds=195&exclusiveFilter=false
    ↓
SQL: SELECT DISTINCT p.* FROM dbo.Pictures p
     WHERE EXISTS (SELECT 1 FROM dbo.NamePhoto np 
                   WHERE np.npFileName = p.PFileName 
                   AND np.npID = 195)
    ↓
Results: Returns all photos where NamePhoto.npID=195 
         (195 is in the NamePhoto table for that photo)
    ↓
For each photo:
   - Returns PThumbnailUrl = /api/media/FamilyAlbum/photo.jpg?thumbnail=true
    ↓
Frontend loads thumbnails:
   - Browser requests /api/media/FamilyAlbum/photo.jpg?thumbnail=true
   - API generates 300px thumbnail (first time)
   - API caches thumbnail in Azure Blob Storage
   - Browser displays thumbnail
    ↓
Gallery shows all photos with Adam Hodges
```

---

## Important Notes

- **Filtering is done in NamePhoto table**, not PPeopleList
  - PPeopleList is legacy and may not be current
  - NamePhoto is the source of truth for who appears in each photo

- **Thumbnails are lazy-generated**
  - Not pre-generated when you select a person
  - Generated on first image load
  - Cached for future use

- **Video thumbnails use FFmpeg**
  - First frame is extracted
  - Can be slow for large videos
  - Fallback to placeholder if extraction fails

- **Exclusive vs Inclusive filtering**
  - Inclusive (default): Person A OR Person B OR Person C
  - Exclusive: Person A AND Person B AND Person C (all must be in photo)
