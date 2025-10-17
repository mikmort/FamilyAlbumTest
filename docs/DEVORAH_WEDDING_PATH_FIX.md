# Database Path Issue - Devorah's Wedding Photo

## Problem Identified

The database has **inconsistent path storage** for one photo:

### Current Database State (WRONG):
```
PFileName:      "Family Pictures\DevorahWedding.jpg"
PFileDirectory: "Family Pictures"
```

This causes the API to generate the URL:
```
/api/media/Family%20Pictures%2FDevorahWedding.jpg
```

Which tries to find the blob at: `Family Pictures/DevorahWedding.jpg`

### What It Should Be:
```
PFileName:      "DevorahWedding.jpg"
PFileDirectory: "Devorah's Wedding"
```

Which would generate:
```
/api/media/Devorah's%20Wedding%2FDevorahWedding.jpg
```

Looking for blob at: `Devorah's Wedding/DevorahWedding.jpg`

## Root Cause

The `Pictures` table schema separates directory and filename:
- `PFileDirectory` - stores the directory path (e.g., "Devorah's Wedding")
- `PFileName` - should store ONLY the filename (e.g., "PA130111.JPG")

But one entry has the directory path duplicated in `PFileName`, causing incorrect URL construction.

## Correct Entries (for comparison)

Other Devorah's Wedding photos are stored correctly:
```
PFileName:      "PA130132.JPG"
PFileDirectory: "Devorah's Wedding"
→ URL: /api/media/Devorah's%20Wedding%2FPA130132.JPG ✓
```

## Solution

Run the SQL fix script to correct the database:

```powershell
.\scripts\fix-database-paths.ps1
```

Or run the SQL manually:

```sql
UPDATE dbo.Pictures
SET 
    PFileDirectory = 'Devorah''s Wedding',
    PFileName = 'DevorahWedding.jpg'
WHERE PFileName = 'Family Pictures\DevorahWedding.jpg'
  AND PFileDirectory = 'Family Pictures';
```

## How the API Combines Paths

From `api/media/index.js` (lines 220-242):

```javascript
const directory = item.PFileDirectory || '';
const fileName = item.PFileName || '';

let blobPath;
if (directory && fileName.startsWith(directory)) {
    // Filename already contains the full path
    blobPath = fileName;
} else if (directory) {
    // Need to combine directory and filename
    blobPath = `${directory}/${fileName}`;
} else {
    // No directory, just use filename
    blobPath = fileName;
}

// Normalize slashes
blobPath = blobPath.replace(/\\/g, '/').replace(/\/+/g, '/');
```

The problematic entry triggers the first condition because:
- `"Family Pictures\DevorahWedding.jpg".startsWith("Family Pictures")` = `true`
- So it uses the full `PFileName` as-is, which has the wrong directory

## Files Created

1. **`scripts/fix-devorah-wedding-paths.sql`** - SQL to fix this specific issue
2. **`scripts/fix-all-duplicate-paths.sql`** - More comprehensive fix for similar issues
3. **`scripts/fix-database-paths.ps1`** - PowerShell script to run the SQL fix
4. **`scripts/check-api-paths.js`** - Node script to check what the API returns

## After Fixing

1. Run the fix script
2. Refresh your browser (the API will fetch fresh data from the database)
3. Click on the Devorah Wedding photo - it should now load correctly
