# Convert Existing Videos Script

This script converts existing `.avi` and `.mov` files in Azure Blob Storage to `.mp4` format.

## Prerequisites

1. **FFmpeg** installed and available in PATH
   - Download from: https://ffmpeg.org/download.html
   - Or install via chocolatey: `choco install ffmpeg`

2. **Azure CLI** installed and authenticated
   - `az login`

3. **Environment variables** set (or edit script directly):
   ```powershell
   $env:AZURE_STORAGE_ACCOUNT = "your-storage-account"
   $env:AZURE_STORAGE_KEY = "your-storage-key"  # Optional if using az login
   $env:SQL_SERVER = "your-server.database.windows.net"
   $env:SQL_DATABASE = "FamilyAlbum"
   $env:SQL_USER = "your-username"
   $env:SQL_PASSWORD = "your-password"
   ```

## Usage

### Dry Run (Preview Only)
See what files would be converted without making changes:
```powershell
.\convert-existing-videos.ps1 -DryRun
```

### Convert with Confirmation
Convert files with a confirmation prompt:
```powershell
.\convert-existing-videos.ps1
```

### Convert Without Confirmation
Convert files automatically:
```powershell
.\convert-existing-videos.ps1 -Force
```

## What It Does

1. **Lists** all `.avi` and `.mov` files in `family-album-media` container
2. **Checks** if `.mp4` version already exists (skips if found)
3. **Downloads** original file to temp directory
4. **Converts** using FFmpeg with browser-compatible settings:
   - H.264 video codec
   - AAC audio codec
   - yuv420p pixel format
   - Fast start for streaming
5. **Uploads** converted `.mp4` file with correct Content-Type
6. **Updates** database records (Pictures and NamePhoto tables)
7. **Deletes** original file
8. **Cleans up** temp files

## Settings

The script uses these FFmpeg settings (same as automatic conversion):
- Video codec: libx264
- Audio codec: aac
- Pixel format: yuv420p (browser compatible)
- Preset: fast
- CRF: 23 (good quality)
- Movflags: +faststart (streaming optimized)

## Error Handling

- Skips files if `.mp4` version already exists
- Continues to next file if conversion fails
- Cleans up temp files even on error
- Shows summary at the end

## Examples

### Preview what would be converted:
```powershell
.\convert-existing-videos.ps1 -DryRun
```

Output:
```
Found 5 files to convert:
  - MVI_0001.avi
  - MVI_0002.mov
  - video.AVI
  ...
```

### Convert all files:
```powershell
.\convert-existing-videos.ps1 -Force
```

Output:
```
Processing: MVI_0001.avi
  Downloading...
  Downloaded: 45.2 MB
  Converting to MP4...
  Converted: 38.7 MB
  Uploading MP4...
  ✓ Uploaded: MVI_0001.mp4
  Updating database...
  ✓ Database updated
  Deleting original file...
  ✓ Deleted: MVI_0001.avi
✓ Successfully converted: MVI_0001.avi -> MVI_0001.mp4

========================================
Conversion Complete
========================================
Success: 5
Failed:  0
Skipped: 0
```

## Notes

- Large files may take several minutes to convert
- Requires sufficient disk space in temp directory
- Database updates require SQL credentials
- If database update fails, you'll need to update manually:
  ```sql
  UPDATE dbo.Pictures SET PFileName = 'newname.mp4' WHERE PFileName = 'oldname.avi';
  UPDATE dbo.NamePhoto SET npFileName = 'newname.mp4' WHERE npFileName = 'oldname.avi';
  ```

## Troubleshooting

**FFmpeg not found:**
- Install FFmpeg and add to PATH
- Or install via chocolatey: `choco install ffmpeg`

**Azure CLI not authenticated:**
```powershell
az login
```

**Database connection fails:**
- Check SQL credentials in environment variables
- Ensure firewall allows your IP address
- Script will continue without database update

**Conversion fails:**
- Check FFmpeg output for errors
- Verify source file is not corrupted
- Try converting a single file manually first
