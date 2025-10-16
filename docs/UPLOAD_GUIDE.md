# How to Upload Photos from E:\Family Album\Albums

This guide walks you through uploading photos from your Albums directory.

## Prerequisites

1. **Azure SQL Database** - Must be set up and configured
2. **Azure Storage Account** - Must be set up with a container
3. **Environment Variables** - Set in `.env.local` file in the project root
4. **Azure Functions Core Tools** - Installed on your machine

## Step 1: Verify Environment Configuration

Make sure your `.env.local` file exists in the project root with these variables:

```
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=your-database-name
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password
AZURE_STORAGE_ACCOUNT=yourstorageaccount
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONTAINER=family-album-media
```

## Step 2: Start the Azure Functions API

Open a terminal in the project root and run:

```powershell
cd api
npm install  # Only needed first time
npm start
```

Wait for the message: `Functions: upload: [POST] http://localhost:7071/api/upload`

## Step 3: Run the Upload Script

Open a **new terminal** (keep the API running in the first one) and run:

```powershell
cd scripts
.\upload-albums.ps1
```

The script will:
1. Check if the source directory exists (`E:\Family Album\Albums`)
2. Verify the API is running
3. Scan for all media files (jpg, png, gif, mp4, etc.)
4. Show you a preview of files to upload
5. Ask for confirmation
6. Upload all files with progress tracking

## Step 4: Monitor Progress

The script will display:
- Current file being uploaded
- Progress percentage
- Success/failure status for each file
- Final summary with total counts

Example output:
```
[1/150] (0.67%) Uploading: vacation-2020.jpg
  ✓ Success: 1634567890-vacation-2020.jpg
[2/150] (1.33%) Uploading: birthday-party.jpg
  ✓ Success: 1634567891-birthday-party.jpg
...
```

## Step 5: Verify Upload

After upload completes, you can verify in two ways:

1. **Check the database** - UnindexedFiles table should have new entries:
   ```sql
   SELECT COUNT(*) FROM dbo.UnindexedFiles WHERE uiStatus = 'N'
   ```

2. **Check Azure Storage** - Files should be in the `media/` folder of your container

## Troubleshooting

### "Directory not found: E:\Family Album\Albums"
- Verify the drive letter and path are correct
- Check if you have access to the network drive/location

### "Azure Functions API is not running!"
- Make sure you ran `npm start` in the `api` folder
- Check if port 7071 is already in use
- Look for any error messages in the Functions terminal

### Upload fails with "500 Internal Server Error"
- Check the Azure Functions terminal for error details
- Verify database connection strings in `.env.local`
- Ensure Azure Storage account credentials are correct

### Files uploading slowly
- This is normal for large files or many files
- The script adds a 100ms delay between uploads to avoid overwhelming the API
- You can continue other work while it runs

## Advanced Usage

### Upload from a different directory

```powershell
.\scripts\bulk-upload-photos.ps1 -SourceDirectory "D:\Photos\2024"
```

### Preview files without uploading (dry run)

```powershell
.\scripts\bulk-upload-photos.ps1 -SourceDirectory "E:\Family Album\Albums" -WhatIf
```

### Use custom API endpoint (for production)

```powershell
.\scripts\bulk-upload-photos.ps1 -SourceDirectory "E:\Family Album\Albums" -ApiEndpoint "https://your-app.azurewebsites.net/api/upload"
```

## Next Steps

After uploading:
1. Files will be in the `UnindexedFiles` table with status 'N' (new)
2. You can then process them through the UI to:
   - Add people tags
   - Set dates
   - Add descriptions
   - Move to the main Pictures table

## Notes

- Original filenames are preserved in the database
- Files are renamed with timestamps to avoid conflicts
- Directory structure from source is preserved in the database
- Both images and videos are supported
- Large files may take longer to upload
