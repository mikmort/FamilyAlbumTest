# File Path Corruption Issue - REAL PROBLEM!

## The Real Issue

The "video thumbnails not working" issue is actually a **DATABASE PATH CORRUPTION** problem affecting ALL media files, not just videos!

## Evidence

Console errors show URLs like:
```
/api/media/B:/Family%20Album/Events/Birthdays/Heather's%205th%20Birthday/Events/Birthdays/Heather's%205th%20Birthday/109_0943.JPG
```

### Problems with this path:

1. **Windows drive letter**: `B:/` should NOT be in blob storage paths
2. **Duplicate directory path**: `Events/Birthdays/Heather's%205th%20Birthday` appears TWICE
3. **Wrong prefix**: `Family Album/` shouldn't be in the path (it's implied in blob container)

### Correct path should be:
```
/api/media/Events/Birthdays/Heather's%205th%20Birthday/109_0943.JPG
```

## Root Cause

During data migration from the original PhotoOrganizer database, the `PFileName` field was stored with:
- Full Windows file paths including drive letters (B:, C:, etc.)
- Duplicate directory segments
- Inconsistent path separators (\ vs /)

## Impact

- **ALL media thumbnails return 404** (images AND videos)
- Photos appearing to work are likely cached or have correct paths by chance
- The purple "VIDEO" boxes are just broken image thumbnails with video overlay

## Solution

### Step 1: Fix the Database

Run this PowerShell script to fix all paths in the database:

```powershell
cd C:\Users\mikmort\Documents\Code\FamilyAlbumTest
.\scripts\fix-database-path-corruption.ps1 -DryRun

# Review the changes, then run for real:
.\scripts\fix-database-path-corruption.ps1
```

This will:
1. Remove drive letters (B:, C:, D:, etc.)
2. Remove duplicate directory paths
3. Convert backslashes to forward slashes
4. Remove "Family Album/" prefix

### Step 2: Upload Fixed Database

After fixing locally, export the corrected data to Azure SQL:

```powershell
.\scripts\migrate-data.ps1
```

### Step 3: Clear Cache and Test

1. Clear browser cache
2. Restart Azure Functions
3. Test image and video thumbnails

## Prevention

When uploading new files, ensure:
- Paths are relative to blob storage root
- No Windows drive letters
- Forward slashes only
- No duplicate directory segments

## Files to Check

- `scripts/fix-database-path-corruption.ps1` - Main fix script
- `scripts/check-duplicate-paths.js` - Diagnostic script
- `database/fix-file-paths.sql` - SQL version of fixes
