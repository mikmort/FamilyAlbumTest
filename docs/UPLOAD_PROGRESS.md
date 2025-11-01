# Media Upload Progress - November 1, 2025

## Current Status: 🔄 **UPLOADING IN PROGRESS**

### What's Happening Now
- **Script Running:** `upload-missing-mov-files.ps1`
- **Terminal ID:** 52c0fd52-3da3-4f93-ae5f-4aa88f1c3211
- **Files to Upload:** 70 MOV files
- **Total Size:** 8.3 GB
- **Estimated Time:** 20-30 minutes (depending on connection speed)

### Files Being Uploaded

#### ES BnotMitzvah Event (8 files - 4.3 GB)
- MVI_5725.MOV - MVI_5768.MOV
- Largest files: MVI_5747.MOV (1.7 GB), MVI_5753.MOV (1.6 GB), MVI_5741.MOV (839 MB)

#### Thanksgiving 2012 (26 files - 1.8 GB)
- MVI_5250.MOV through MVI_5308.MOV
- All the files causing 404 errors in the browser

#### Thanksgiving 2013/Mike (10 files - 1.3 GB)
- MVI_0023.MOV, MVI_0048.MOV, MVI_0055.MOV, MVI_0056.MOV, MVI_0057.MOV
- MVI_0079.MOV, MVI_0080.MOV, MVI_0098.MOV, MVI_0157.MOV, MVI_0191.MOV

#### Thanksgiving 2002 (9 files - 37 MB)
- PB240047.MOV through PB270016.MOV

#### Other Locations (17 files - 164 MB)
- Milwaukee (9 files), Charlottesville (3 files), Florida (2 files), Family Pictures (1 file), etc.

## What Happens After Upload

### Step 1: Convert MOV to MP4 ✅ Script Ready
Once upload completes, convert the MOV files to browser-friendly MP4 format:
```powershell
cd api
node ..\scripts\convert-blob-mov-to-mp4.js
```

**What this does:**
- Downloads each MOV file from blob storage
- Converts to H.264/AAC MP4 using FFmpeg
- Uploads the MP4 version back to storage
- Keeps original MOV files in storage
- Expected: 30-50% file size reduction

**Script:** `scripts/convert-blob-mov-to-mp4.js`

### Step 2: Update Database References
After conversion, update the database to point to `.mp4` files instead of `.MOV`:
```powershell
node ..\scripts\update-database-after-conversion.js
```

**What this does:**
- Queries database for all .MOV references
- Checks blob storage for corresponding .mp4 files
- Generates SQL UPDATE statements
- Creates `scripts/update-mov-to-mp4.sql`

**Then:** Open the SQL file in Azure Data Studio and execute it

### Step 3: Clean Up Placeholder Thumbnails
Delete old tiny placeholder thumbnails so new ones generate:
```powershell
node ..\scripts\cleanup-placeholder-thumbnails.js
```

**What this does:**
- Finds thumbnails < 100 bytes (old 1x1 pixel placeholders)
- Deletes them from blob storage
- Next request will generate new SVG placeholders or real thumbnails

### Step 4: Verify
- Refresh the gallery in browser
- Check that video thumbnails appear (either real thumbnails or SVG placeholders)
- Test video playback for converted files

## Scripts Created

### 1. audit-media-files.ps1
Comprehensive audit comparing local files with blob storage.
- **Usage:** `.\scripts\audit-media-files.ps1 -MOVOnly [-UploadMissing] [-ConvertMOVtoMP4]`
- **Output:** `scripts/media-audit-report.json`

### 2. upload-missing-mov-files.ps1 ⭐ **Currently Running**
Simple, reliable upload for missing MOV files.
- **Usage:** `.\scripts\upload-missing-mov-files.ps1 [-DryRun]`
- **Features:** Progress tracking, size reporting, upload speed calculation

### 3. convert-blob-mov-to-mp4.js
Converts MOV files already in blob storage to MP4.
- **Usage:** `cd api && node ..\scripts\convert-blob-mov-to-mp4.js`
- **Requires:** FFmpeg installed, AZURE_STORAGE_KEY set
- **Features:** Skips existing MP4s, reports compression savings

### 4. check-thanksgiving-mov.js
Quick database query for MOV files in Thanksgiving folders.
- **Usage:** `cd api && node ..\scripts\check-thanksgiving-mov.js`
- **Note:** Requires Azure SQL connection from local machine

## Root Cause Analysis

### The Problem
Browser showing 404 errors for video thumbnails:
```
GET .../MVI_5273.MOV?thumbnail=true 404 (Not Found)
```

### Why It Happened
1. **Files Never Uploaded:** MOV files existed locally in `E:\Family Album` but were never uploaded to Azure Blob Storage
2. **Database References:** Database had correct references to these files
3. **Codec Issues:** Even for uploaded MOVs, some use H.265/HEVC codec that FFmpeg struggles with
4. **Tiny Placeholders:** When FFmpeg failed, API generated 1x1 pixel placeholder (barely visible)

### The Solution
1. **Upload MOV Files:** Get all missing files into blob storage ✅ **IN PROGRESS**
2. **Convert to MP4:** Transcode to H.264/AAC for universal compatibility ⏳ **NEXT**
3. **Update Database:** Change references from .MOV to .mp4 ⏳ **AFTER CONVERSION**
4. **Better Placeholders:** SVG with play icon (already deployed) ✅ **DONE**

## Files Changed in This Session

### Created
- `scripts/audit-media-files.ps1` - Full media audit tool
- `scripts/upload-missing-mov-files.ps1` - Simple upload script (IN USE)
- `scripts/convert-blob-mov-to-mp4.js` - Blob-based conversion
- `scripts/check-thanksgiving-mov.js` - Database query helper
- `docs/MEDIA_AUDIT.md` - Audit documentation
- `docs/UPLOAD_PROGRESS.md` - This file

### Modified
- None (upload in progress, no code changes needed)

## Monitoring Upload Progress

Check upload status anytime with:
```powershell
# View terminal output
Get-Content variable:\PSVersionTable

# Or check blob count
cd api
az storage blob list --account-name famprodgajerhxssqswm --account-key $env:AZURE_STORAGE_KEY --container-name family-album-media --query "[?ends_with(name, '.MOV') || ends_with(name, '.mov')]" | ConvertFrom-Json | Measure-Object
```

## Expected Timeline

| Step | Duration | Status |
|------|----------|--------|
| Upload 70 MOV files (8.3 GB) | 20-30 min | 🔄 **IN PROGRESS** |
| Convert to MP4 (70 files) | 60-90 min | ⏳ Waiting |
| Update database | 2 min | ⏳ Waiting |
| Clean thumbnails | 1 min | ⏳ Waiting |
| **Total** | **~2 hours** | - |

## Notes
- Upload speed depends on internet connection
- Conversion speed depends on CPU (FFmpeg encoding)
- Original MOV files will be kept in storage (not deleted)
- Both MOV and MP4 versions will exist after conversion
- Database will reference MP4 versions after update
- MOV files can be manually deleted later if desired to save space

---

**Last Updated:** November 1, 2025, 8:50 PM  
**Next Check:** Monitor terminal output for completion message
