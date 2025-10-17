# Missing Media Files Issue

## Problem

The images are not displaying because **the actual media files don't exist in Azure Blob Storage**.

### What Happened

1. You migrated the **database** from SQLite to Azure SQL ✓
   - All metadata (filenames, directories, dates, etc.) is in the database
   - The `Pictures` table has all the correct information

2. But you **didn't upload the actual image/video files** to Azure Blob Storage ✗
   - The database knows about "Devorah's Wedding\PA130068.JPG"
   - But that file doesn't exist in Azure Blob Storage
   - So the API returns 404 or 500 errors

### Evidence

Testing various files from the database:
```
✗ GET /api/media/Devorah's%20Wedding/PA130132.JPG → 500 error
✗ GET /api/media/Events/Weddings/ELizaAsh%20Wedding/IMG_5213.jpg → 404 error  
✗ GET /api/media/On%20Location/Florida%20May%202006/dentist.wmv → 404 error
```

All return errors because the files don't exist in blob storage.

## Solution

Upload your actual media files from your local drive to Azure Blob Storage, matching the paths in the database.

### Step 1: Run with -WhatIf to Preview

```powershell
.\scripts\upload-existing-files.ps1 -SourceDirectory "E:\Family Album" -WhatIf
```

This will show you what would be uploaded without actually doing it.

### Step 2: Run the Actual Upload

```powershell
.\scripts\upload-existing-files.ps1 -SourceDirectory "E:\Family Album"
```

This script will:
1. Fetch all media entries from the database (via API)
2. For each entry, find the corresponding file on your local drive
3. Upload it to Azure Blob Storage with the exact path from the database
4. Skip files that already exist in blob storage
5. Report any files that can't be found on disk

### What the Script Does

The script uses the same path logic as your API:
- If `PFileDirectory` = "Devorah's Wedding" and `PFileName` = "PA130132.JPG"
- It looks for: `E:\Family Album\Devorah's Wedding\PA130132.JPG`
- And uploads to blob storage as: `Devorah's Wedding/PA130132.JPG`

### Prerequisites

1. **Az.Storage PowerShell Module**
   ```powershell
   Install-Module -Name Az.Storage -Scope CurrentUser
   ```

2. **Azure Storage Credentials**
   - Make sure `api/local.settings.json` has:
     - `AZURE_STORAGE_ACCOUNT`
     - `AZURE_STORAGE_KEY`
     - `AZURE_STORAGE_CONTAINER`

3. **Access to Original Files**
   - You need the original files in `E:\Family Album\`
   - With the same directory structure as in the database

### After Upload

Once the files are uploaded:
1. Refresh your browser
2. Click on any image
3. It should now display correctly!

## Alternative: Manual Azure Storage Explorer

If you prefer a GUI, you can use [Azure Storage Explorer](https://azure.microsoft.com/en-us/products/storage/storage-explorer/):

1. Download and install Azure Storage Explorer
2. Connect to your storage account
3. Navigate to your container (probably `family-album-media`)
4. Upload your `E:\Family Album\` folder
5. Make sure to preserve the directory structure

## Notes

- The script skips files that already exist (safe to re-run)
- Files not found on disk will be reported (you may need to update the database or find the files)
- Forward slashes (`/`) are used in blob storage, even though the database has backslashes (`\`)
