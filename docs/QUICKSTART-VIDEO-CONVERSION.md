# Quick Start: Convert Videos to MP4

## One-Time Setup

```powershell
# 1. Install FFmpeg
winget install Gyan.FFmpeg

# 2. Set Azure Storage Key
$env:AZURE_STORAGE_KEY = "your-storage-account-key"
```

## Conversion Process

```powershell
# 1. Preview what will be converted (no changes)
.\scripts\convert-videos-to-mp4.ps1 -DryRun

# 2. Convert all MOV files
.\scripts\convert-videos-to-mp4.ps1

# 3. Update database
cd api
node ..\scripts\update-database-after-conversion.js

# 4. Run the generated SQL script
# Open scripts/update-mov-to-mp4.sql in Azure Data Studio
# Review and execute it

# 5. Clean up old placeholder thumbnails
node ..\scripts\cleanup-placeholder-thumbnails.js
```

## What This Does

✅ Converts MOV → MP4 (H.264 codec)  
✅ Enables in-browser playback  
✅ Fixes thumbnail generation  
✅ Reduces file sizes by ~30-50%  
✅ Original MOV files preserved  

## Full Documentation

See [docs/VIDEO_CONVERSION.md](../docs/VIDEO_CONVERSION.md) for:
- Detailed step-by-step guide
- Troubleshooting
- Advanced options
- Cleanup procedures
