# WMV to MP4 Conversion - Summary

**Date:** November 15, 2025  
**Task:** Convert WMV files to MP4 format and update database

## Results

✅ **Successfully converted 1 WMV file to MP4**

### Converted File

**Original:** `On Location/Florida May 2006/dentist.wmv` (1.36 MB)  
**New:** `On Location/Florida May 2006/dentist.mp4` (0.65 MB)  
**Size Reduction:** 52% smaller

### Associated People/Events
- Elissa Morton
- Rachel Morton  
- Stephanie Morton

## What Was Done

1. **Identified WMV files** - Found 1 WMV file in the database
2. **Downloaded** - Retrieved the original WMV from Azure Blob Storage
3. **Converted** - Used FFmpeg to convert to MP4 with H.264 video codec and AAC audio
4. **Uploaded** - Uploaded the new MP4 to Azure Blob Storage
5. **Updated Database** - Updated all references in a transaction:
   - Created new record in `Pictures` table with MP4 filename
   - Updated `NamePhoto` associations to reference new MP4 filename
   - Updated `FaceEmbeddings` references (if any)
   - Updated `FaceEncodings` references (if any)
   - Deleted old WMV record
6. **Cleaned Up** - Deleted original WMV from blob storage

## Scripts Created

- **`scripts/convert-wmv-files.js`** - Main conversion script
- **`scripts/list-wmv-files.js`** - Query to list WMV files
- **`scripts/verify-wmv-conversion.js`** - Verification script

## Verification

✓ 0 WMV files remaining in database  
✓ MP4 file exists in database  
✓ All people/event associations preserved  
✓ Original WMV deleted from blob storage

## Benefits of MP4 Format

- **Better Browser Compatibility** - Plays in all modern browsers
- **Smaller File Size** - 52% reduction in this case
- **Streaming Support** - FastStart flag enables progressive loading
- **Standard Codec** - H.264 video and AAC audio are widely supported

## FFmpeg Conversion Settings

```bash
ffmpeg -i input.wmv \
  -c:v libx264 \
  -preset medium \
  -crf 23 \
  -c:a aac \
  -b:a 128k \
  -movflags +faststart \
  output.mp4
```

- **Video Codec:** H.264 (libx264)
- **Quality:** CRF 23 (good quality, smaller size)
- **Audio Codec:** AAC at 128k bitrate
- **FastStart:** Enables web streaming

## Notes

The script handles the conversion safely with:
- Database transactions to maintain referential integrity
- Error handling with rollback on failure
- Temporary file cleanup
- Foreign key constraint updates for all related tables

All people/event tags were preserved during the conversion.
