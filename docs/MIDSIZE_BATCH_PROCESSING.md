# Generate Midsize Images - Batch Processing

This script generates 1080px midsize versions for all existing large images in your Family Album.

## Why Run This?

After adding the midsize image feature, all existing photos (uploaded before this feature) don't have midsize versions yet. This script processes them in batches.

**Current Status:** 9,585 images need midsize versions

## Option 1: Run via Azure Functions (Admin UI)

**⚠️ Note:** The Azure Functions endpoint is currently failing. Use Option 2 instead.

1. Go to https://www.mortonfamilyalbum.com/
2. Navigate to Admin Settings
3. Scroll to "Midsize Image Generation"
4. Click "Process 50 Images" or "Process 200 Images (Large Batch)"
5. Wait for completion and repeat

## Option 2: Run Script Locally (Recommended)

**Requirements:**
- Linux, macOS, or Windows x64 (NOT ARM64)
- Node.js 18+
- Sharp library must be compatible with your system

**Steps:**

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set environment variables** (if not using .env.local):
   ```bash
   export AZURE_SQL_SERVER=familyalbum-prod-sql-gajerhxssqswm.database.windows.net
   export AZURE_SQL_DATABASE=FamilyAlbum
   export AZURE_SQL_USER=familyadmin
   export AZURE_SQL_PASSWORD=Jam3jam3!
   export AZURE_STORAGE_ACCOUNT=famprodgajerhxssqswm
   export AZURE_STORAGE_KEY=<your_key>
   export AZURE_STORAGE_CONTAINER=family-album-media
   ```

3. **Run the script** (processes 50 images by default):
   ```bash
   node scripts/generate-midsize-batch.js
   ```

   Or specify a custom batch size:
   ```bash
   node scripts/generate-midsize-batch.js 100
   ```

4. **Repeat** until all images are processed. The script will tell you how many remain.

## Option 3: Run in Azure Cloud Shell

**Best option if Sharp doesn't work locally:**

1. Open [Azure Cloud Shell](https://shell.azure.com)
2. Clone the repository:
   ```bash
   git clone https://github.com/mikmort/FamilyAlbumTest.git
   cd FamilyAlbumTest
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Set environment variables:
   ```bash
   export AZURE_SQL_SERVER=familyalbum-prod-sql-gajerhxssqswm.database.windows.net
   export AZURE_SQL_DATABASE=FamilyAlbum
   export AZURE_SQL_USER=familyadmin
   export AZURE_SQL_PASSWORD=Jam3jam3!
   export AZURE_STORAGE_ACCOUNT=famprodgajerhxssqswm
   export AZURE_STORAGE_KEY=<your_key>
   export AZURE_STORAGE_CONTAINER=family-album-media
   ```

5. Run the script:
   ```bash
   node scripts/generate-midsize-batch.js 100
   ```

6. **To process all 9,585 images:**
   ```bash
   # Process in large batches (200 at a time)
   for i in {1..50}; do
     echo "Batch $i"
     node scripts/generate-midsize-batch.js 200
     sleep 5  # Brief pause between batches
   done
   ```

## What the Script Does

For each image:
1. Downloads original from Azure Blob Storage
2. Checks if it's larger than 1080px
3. Resizes to max 1080px (maintains aspect ratio)
4. Compresses to JPEG quality 85%
5. Uploads as `filename-midsize.jpg`
6. Updates database with midsize URL

**Performance:** 
- ~2-5 seconds per image
- Saves 50-80% file size on average
- Processing 9,585 images takes ~5-13 hours total

## Monitoring Progress

The script outputs:
- ✓ Succeeded: Images with midsize created
- ✗ Failed: Errors (file not found, processing issues)
- ⊗ Skipped: Images already small enough (<1080px)
- Remaining: How many still need processing

## Troubleshooting

**"Sharp module not available" on Windows ARM64:**
- Use Azure Cloud Shell (Option 3)
- Or run on a Linux/macOS/Windows x64 machine

**"Database connection failed":**
- Check environment variables are set correctly
- Verify Azure SQL firewall allows your IP

**"Blob not found":**
- Some database entries may reference deleted files
- These are automatically skipped

## Future Uploads

New uploads automatically generate midsize versions - no batch processing needed!
