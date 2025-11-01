# Media Files Audit & Upload

## Summary

This document tracks the process of synchronizing local media files with Azure Blob Storage.

## Audit Results (MOV Files Only)

- **Date:** November 1, 2025
- **Local Source:** E:\Family Album  
- **Destination:** Azure Blob Storage (famprodgajerhxssqswm/family-album-media)

### Statistics

- ✅ Files in both locations: **7**
- ⚠️ Missing from blob storage: **71**  
- ℹ️ Files in blob but not local: **4,993** (mostly JPG files from full scan)

### Missing Files (Selected Examples)

#### Thanksgiving Videos (26 files)
- Thanksgiving 2012: 26 MOV files (MVI_5250 through MVI_5308)
- Thanksgiving 2013: 10 MOV files in Mike subfolder
- Thanksgiving 2002: 4 MOV files (PB240049, PB240052, PB240055, PB260093, PB260096, PB260097)

#### ES BnotMitzvah Event (8 files)
- MVI_5712.MOV (37.92 MB)
- MVI_5725.MOV (84.76 MB)  
- MVI_5732.MOV (280.01 MB)
- MVI_5734.MOV (174.22 MB)
- MVI_5735.MOV (293.94 MB)
- MVI_5741.MOV (838.89 MB) - **Largest file**
- MVI_5753.MOV (1,630.49 MB) - **Largest file**
- MVI_5768.MOV (286.73 MB)

#### Other Locations
- Milwaukee Feb 2003: 5 MOV files
- Milwaukee Aug 2003: 3 MOV files
- Florida 2002: 1 MOV file
- Florida Jan 2003: 1 MOV file
- Charlottesville: 3 MOV files
- Family Pictures: 1 MOV file

## Upload Process

### Strategy
1. **Convert MOV → MP4:** All MOV files converted to H.264/AAC MP4 format
2. **Quality Settings:** CRF 23, medium preset, 128kbps audio
3. **Web Optimization:** `+faststart` flag for progressive streaming
4. **Expected Size Reduction:** 30-50% file size savings

### Benefits
- ✅ Universal browser compatibility (H.264 codec)
- ✅ Smaller file sizes (faster downloads, lower storage costs)
- ✅ Thumbnail generation will work in Azure Function
- ✅ Progressive playback support

### Script Used
```powershell
$env:AZURE_STORAGE_KEY = "your-key"
.\scripts\audit-media-files.ps1 -MOVOnly -UploadMissing -ConvertMOVtoMP4
```

## Next Steps

After upload completes:

1. **Update Database References**  
   Run the database update script to change `.MOV` to `.mp4` in the Pictures table:
   ```powershell
   cd api
   node ..\scripts\update-database-after-conversion.js
   ```

2. **Execute SQL Script**  
   - Open generated `scripts/update-mov-to-mp4.sql`
   - Review the UPDATE statements
   - Execute against Azure SQL Database

3. **Clean Up Placeholder Thumbnails**  
   Delete old tiny placeholder thumbnails to force regeneration with new videos:
   ```powershell
   cd api
   node ..\scripts\cleanup-placeholder-thumbnails.js
   ```

4. **Verify in Browser**  
   - Refresh the gallery page
   - Check that video thumbnails load properly
   - Test video playback for converted files

## Tools Created

### audit-media-files.ps1
Comprehensive audit script that:
- Compares local filesystem with blob storage
- Identifies missing files in either location
- Optionally uploads missing files
- Optionally converts MOV to MP4 during upload
- Generates JSON report for analysis

**Parameters:**
- `-LocalPath`: Path to Family Album folder (default: E:\Family Album)
- `-MOVOnly`: Only process MOV files
- `-UploadMissing`: Upload files found locally but not in blob
- `-ConvertMOVtoMP4`: Convert MOV to MP4 during upload

**Output:**
- `scripts/media-audit-report.json`: Full audit results

### check-thanksgiving-mov.js
Quick database query to check MOV references in Thanksgiving folders.

## Files Changed

- Created: `scripts/audit-media-files.ps1`
- Created: `scripts/check-thanksgiving-mov.js`  
- Created: `docs/MEDIA_AUDIT.md` (this file)

## Notes

- Original MOV files remain on local E: drive (not deleted)
- MP4 versions uploaded to blob storage
- Database still references `.MOV` extensions until update script runs
- Estimated total upload size: ~4-5 GB (before compression)
- Estimated upload time: 30-60 minutes (depending on connection speed)
