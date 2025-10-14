-- Migration Script from SQLite to Azure SQL Database
-- This script helps migrate data from your existing FamilyAlbum.db SQLite database
-- to the new Azure SQL Database

-- INSTRUCTIONS:
-- 1. Export data from SQLite to CSV files
-- 2. Upload CSV files to Azure Blob Storage or local folder
-- 3. Use Azure Data Studio or SSMS to run BULK INSERT commands
-- 4. Verify data after migration

-- ============================================
-- STEP 1: Export from SQLite (Run in SQLite)
-- ============================================

-- Export People (neType='N')
.headers on
.mode csv
.output people_export.csv
SELECT 
    ID,
    neName,
    neRelation,
    'N' as neType,
    neDateLastModified,
    neCount
FROM NameEvent
WHERE neType = 'N';

-- Export Events (neType='E')
.output events_export.csv
SELECT 
    ID,
    neName,
    neRelation,
    'E' as neType,
    neDateLastModified,
    neCount
FROM NameEvent
WHERE neType = 'E';

-- Export Pictures
.output pictures_export.csv
SELECT 
    PFileName,
    PFileDirectory,
    PDescription,
    PHeight,
    PWidth,
    PMonth,
    PYear,
    PPeopleList,
    PNameCount,
    PType,
    PTime,
    PDateEntered,
    PLastModifiedDate,
    PReviewed,
    PSoundFile
FROM Pictures;

-- Export NamePhoto associations
.output namephoto_export.csv
SELECT 
    npID,
    npFileName,
    0 as npPosition
FROM NamePhoto;

.output stdout

-- ============================================
-- STEP 2: Import to Azure SQL (Run in Azure Data Studio)
-- ============================================

-- Note: Before running, upload CSV files to a location accessible by Azure SQL
-- Option A: Azure Blob Storage with SAS token
-- Option B: Local import using bcp utility

-- Import People
BULK INSERT dbo.NameEvent
FROM 'C:\Temp\people_export.csv'  -- Update path
WITH (
    FIRSTROW = 2,  -- Skip header row
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    KEEPIDENTITY
);

-- Import Events
BULK INSERT dbo.NameEvent
FROM 'C:\Temp\events_export.csv'  -- Update path
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    KEEPIDENTITY
);

-- For Pictures and NamePhoto, you'll need to handle the new columns
-- (PThumbnailUrl and PBlobUrl) separately after uploading media files

-- ============================================
-- STEP 3: Upload Media Files to Azure Blob Storage
-- ============================================

-- Use Azure Storage Explorer or Azure CLI to upload all photos/videos
-- to the 'family-album-media' container

-- PowerShell example:
-- az storage blob upload-batch --account-name <account> --destination family-album-media --source <local-folder>

-- ============================================
-- STEP 4: Update Picture URLs
-- ============================================

-- After uploading media files, update the URLs in the database
-- This assumes files are uploaded to blob storage with the same filenames

UPDATE dbo.Pictures
SET 
    PBlobUrl = 'https://<your-storage-account>.blob.core.windows.net/family-album-media/media/' + PFileName,
    PThumbnailUrl = 'https://<your-storage-account>.blob.core.windows.net/family-album-media/thumbnails/' + PFileName
WHERE PFileName IS NOT NULL;

-- ============================================
-- STEP 5: Import NamePhoto Associations
-- ============================================

BULK INSERT dbo.NamePhoto
FROM 'C:\Temp\namephoto_export.csv'
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV'
);

-- ============================================
-- STEP 6: Regenerate Thumbnails (Optional)
-- ============================================

-- If thumbnails don't exist in blob storage, you'll need to:
-- 1. Download original images
-- 2. Generate thumbnails using the app's upload API
-- 3. Upload thumbnails to blob storage

-- Or use the app's bulk thumbnail generation feature (to be implemented)

-- ============================================
-- STEP 7: Update Counts
-- ============================================

EXEC dbo.UpdateNameEventCounts;

-- ============================================
-- STEP 8: Verify Data
-- ============================================

-- Check people count
SELECT COUNT(*) as PeopleCount FROM dbo.NameEvent WHERE neType = 'N';

-- Check events count
SELECT COUNT(*) as EventsCount FROM dbo.NameEvent WHERE neType = 'E';

-- Check pictures count
SELECT COUNT(*) as PicturesCount FROM dbo.Pictures;

-- Check associations count
SELECT COUNT(*) as AssociationsCount FROM dbo.NamePhoto;

-- Check for pictures with missing blob URLs
SELECT COUNT(*) as MissingUrls
FROM dbo.Pictures
WHERE PBlobUrl IS NULL OR PThumbnailUrl IS NULL;

-- Sample data check
SELECT TOP 10 
    p.PFileName,
    p.PDescription,
    p.PBlobUrl,
    p.PThumbnailUrl,
    ne.neName as PersonOrEvent
FROM dbo.Pictures p
LEFT JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
LEFT JOIN dbo.NameEvent ne ON np.npID = ne.ID;

-- ============================================
-- NOTES AND TIPS
-- ============================================

/*
1. Data Types:
   - SQLite is more forgiving with data types
   - Azure SQL is strict - ensure proper types

2. BLOBs (Thumbnails):
   - SQLite stores thumbnails as BLOBs in database
   - Azure SQL stores URLs to blob storage
   - Need to extract BLOBs from SQLite and upload to Azure

3. File Organization:
   - Maintain same directory structure
   - Update file paths to match Azure Blob Storage

4. Identity Columns:
   - Use KEEPIDENTITY to preserve original IDs
   - Important for maintaining relationships

5. Large Imports:
   - For large datasets, use bcp utility for better performance
   - Consider batching in chunks of 1000 rows

6. Testing:
   - Migrate a small subset first
   - Verify all relationships are intact
   - Test application with migrated data

7. Backup:
   - Keep original SQLite database
   - Create Azure SQL backup before migration
   - Don't delete original data until verified

8. Cost Monitoring:
   - Monitor storage costs during initial upload
   - Consider using Cool tier for archival photos
   - Set up cost alerts in Azure Portal
*/

-- ============================================
-- Alternative: Python Migration Script
-- ============================================

/*
For a more automated approach, create a Python script:

import sqlite3
import pyodbc
from azure.storage.blob import BlobServiceClient

# Connect to SQLite
sqlite_conn = sqlite3.connect('FamilyAlbum.db')

# Connect to Azure SQL
azure_conn = pyodbc.connect('DRIVER={ODBC Driver 17 for SQL Server};...')

# Connect to Blob Storage
blob_service = BlobServiceClient(...)

# Migrate data table by table
# Upload media files
# Update URLs

# See migration_script.py template for full implementation
*/
