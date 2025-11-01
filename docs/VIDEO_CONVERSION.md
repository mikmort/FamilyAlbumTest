# Video Conversion Guide

This guide explains how to convert old MOV files to modern MP4 format for better browser compatibility and smaller file sizes.

## Why Convert?

**Problems with old MOV files:**
- Use H.265/HEVC or older codecs that browsers can't play
- Require downloading to play locally
- Can't generate thumbnails (FFmpeg fails on some codecs)
- Larger file sizes

**Benefits of MP4 (H.264):**
- ✅ Plays directly in all modern browsers
- ✅ Smaller file sizes (typically 30-50% reduction)
- ✅ Thumbnail generation works reliably
- ✅ Supports streaming (fast start)

## Prerequisites

1. **Install FFmpeg**
   ```powershell
   # Using winget (recommended)
   winget install Gyan.FFmpeg
   
   # Or download from https://ffmpeg.org/download.html
   ```

2. **Set Azure Storage Key**
   ```powershell
   $env:AZURE_STORAGE_KEY = "your-storage-account-key-here"
   ```

## Step 1: Dry Run (Preview)

First, run in dry-run mode to see what will be converted:

```powershell
.\scripts\convert-videos-to-mp4.ps1 -DryRun
```

This will:
- List all MOV files found
- Show which ones already have MP4 versions
- Show which ones would be converted
- **No files will be modified**

## Step 2: Convert Videos

Run the actual conversion:

```powershell
.\scripts\convert-videos-to-mp4.ps1
```

The script will:
- Download each MOV file
- Convert to MP4 with H.264 codec
- Upload the MP4 to blob storage
- Show progress and file size savings
- Skip files that already have MP4 versions

**Options:**
```powershell
# Convert only specific files
.\scripts\convert-videos-to-mp4.ps1 -Filter "Thanksgiving*.MOV"

# Limit concurrent conversions (default: 3)
.\scripts\convert-videos-to-mp4.ps1 -MaxConcurrent 1
```

## Step 3: Update Database

After conversion, update the database to reference the new MP4 files:

```powershell
cd api
node ..\scripts\update-database-after-conversion.js
```

This will:
- Check which MOV entries have been converted
- Generate a SQL script: `scripts/update-mov-to-mp4.sql`
- Show summary of updates

**Review and run the SQL script:**
1. Open `scripts/update-mov-to-mp4.sql` in your SQL editor
2. Review the UPDATE statements
3. Run the script against your database
4. Commit or rollback based on results

## Step 4: Clean Up (Optional)

After confirming everything works with MP4 files:

### Delete old MOV files from blob storage
```powershell
# List MOV files that have MP4 equivalents
az storage blob list \
  --account-name famprodgajerhxssqswm \
  --container-name family-album-media \
  --query "[?ends_with(name, '.MOV')]"

# Delete them (BE CAREFUL!)
# Only do this after verifying MP4 versions work
```

### Regenerate thumbnails for converted videos
```powershell
cd api
node ..\scripts\cleanup-placeholder-thumbnails.js
```

This deletes old placeholder thumbnails so they regenerate with proper video frames.

## Conversion Settings

The script uses optimal settings for web playback:

```
Video Codec:    H.264 (libx264)
Quality (CRF):  23 (balanced quality/size)
Preset:         medium (balanced speed/compression)
Audio Codec:    AAC
Audio Bitrate:  128 kbps
Fast Start:     Enabled (for web streaming)
```

**Quality levels:**
- CRF 18: High quality, larger files
- CRF 23: Balanced (default)
- CRF 28: Lower quality, smaller files

To change quality, edit the script and modify the `-crf` value.

## Troubleshooting

### FFmpeg not found
```powershell
# Check if FFmpeg is installed
ffmpeg -version

# Add to PATH if needed
$env:PATH += ";C:\ffmpeg\bin"
```

### Conversion fails for specific file
- The file might be corrupted
- Try converting manually: `ffmpeg -i input.MOV -c:v libx264 -crf 23 output.mp4`
- Check FFmpeg error messages in script output

### MP4 uploaded but not showing
- Clear browser cache
- Wait for Azure deployment to complete
- Check blob storage to confirm upload

### Database update failed
- Check that MP4 files exist in blob storage first
- Review the SQL script before running
- Run updates in a transaction so you can rollback

## Expected Results

For a typical family album with ~50 MOV files:

- **Conversion time:** 2-10 minutes per file (depending on length)
- **File size reduction:** 30-50% smaller
- **Browser compatibility:** Works in Chrome, Firefox, Safari, Edge
- **Thumbnail generation:** Succeeds for all converted videos

## Example Session

```powershell
# Preview
.\scripts\convert-videos-to-mp4.ps1 -DryRun
# Output: Found 15 MOV files, 3 already converted, 12 will be converted

# Convert
.\scripts\convert-videos-to-mp4.ps1
# Output: Successfully converted 12 files, saved 245 MB (42% reduction)

# Update database
cd api
node ..\scripts\update-database-after-conversion.js
# Output: Generated update-mov-to-mp4.sql with 12 updates

# Run SQL script in Azure Data Studio or SSMS
# Review changes in browser
# Thumbnails regenerate automatically on first view
```

## Reverting Changes

If you need to revert:

1. **Database:** Use `ROLLBACK` in the SQL transaction
2. **Files:** The original MOV files are preserved (not deleted)
3. **Just change database back to reference .MOV files**

## Next Steps

After conversion:
- Videos play directly in browser
- Thumbnails generate successfully
- Reduced storage costs
- Better user experience

Consider converting other video formats:
- `.AVI` files
- `.WMV` files  
- `.MPG` / `.MPEG` files

Use the same script - just modify the filter:
```powershell
.\scripts\convert-videos-to-mp4.ps1 -Filter "*.AVI"
```
