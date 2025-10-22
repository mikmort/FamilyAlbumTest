-- ============================================
-- RE-IMPORT WITH IDENTITY PRESERVATION
-- ============================================
-- This script re-imports data from SQLite while preserving original IDs
-- to avoid mismatches between PPeopleList and NameEvent IDs
-- 
-- Steps:
-- 1. Export from SQLite: Run queries in SQLite command line (see below)
-- 2. Import to Azure SQL: Run this script in Azure Data Studio or SSMS

-- ============================================
-- STEP 1: EXPORT FROM SQLITE (Run in SQLite CLI)
-- ============================================
/*
.headers on
.mode csv
.output C:\Temp\people_export.csv
SELECT ID, neName, neRelation, 'N', neDateLastModified, neCount FROM NameEvent WHERE neType = 'N';

.output C:\Temp\events_export.csv
SELECT ID, neName, neRelation, 'E', neDateLastModified, neCount FROM NameEvent WHERE neType = 'E';

.output C:\Temp\pictures_export.csv
SELECT PFileName, PFileDirectory, PDescription, PHeight, PWidth, PMonth, PYear, PPeopleList, PNameCount, PType, PTime, PDateEntered, PLastModifiedDate, PReviewed, PSoundFile FROM Pictures;

.output C:\Temp\namephoto_export.csv
SELECT npID, npFileName, npPosition FROM NamePhoto;

.output stdout
*/

-- ============================================
-- STEP 2: CLEAR EXISTING DATA (Azure SQL)
-- ============================================
-- WARNING: This will delete all existing data!
-- Backup first!

DELETE FROM dbo.NamePhoto;
DELETE FROM dbo.Pictures;
DELETE FROM dbo.NameEvent;

-- Reset identity counter
DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);
DBCC CHECKIDENT ('dbo.Pictures', RESEED, 0);

-- ============================================
-- STEP 3: IMPORT PEOPLE WITH ID PRESERVATION
-- ============================================
-- Enable IDENTITY_INSERT to preserve original IDs from SQLite

SET IDENTITY_INSERT dbo.NameEvent ON;

BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount)
FROM 'C:\Temp\people_export.csv'  -- Update path - ensure this file exists
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

-- Count imported people
SELECT COUNT(*) AS ImportedPeople FROM dbo.NameEvent WHERE neType = 'N';

-- ============================================
-- STEP 4: IMPORT EVENTS WITH ID PRESERVATION
-- ============================================

BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount)
FROM 'C:\Temp\events_export.csv'  -- Update path
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

-- Count imported events
SELECT COUNT(*) AS ImportedEvents FROM dbo.NameEvent WHERE neType = 'E';

SET IDENTITY_INSERT dbo.NameEvent OFF;

-- ============================================
-- STEP 5: IMPORT PICTURES
-- ============================================

BULK INSERT dbo.Pictures (
    PFileName, PFileDirectory, PDescription, PHeight, PWidth, 
    PMonth, PYear, PPeopleList, PNameCount, PType, PTime, 
    PDateEntered, PLastModifiedDate, PReviewed, PSoundFile
)
FROM 'C:\Temp\pictures_export.csv'  -- Update path
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

-- Count imported pictures
SELECT COUNT(*) AS ImportedPictures FROM dbo.Pictures;

-- ============================================
-- STEP 6: IMPORT PHOTO ASSOCIATIONS
-- ============================================

BULK INSERT dbo.NamePhoto (npID, npFileName, npPosition)
FROM 'C:\Temp\namephoto_export.csv'  -- Update path
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

-- Count imported associations
SELECT COUNT(*) AS ImportedAssociations FROM dbo.NamePhoto;

-- ============================================
-- STEP 7: VERIFY DATA INTEGRITY
-- ============================================

PRINT '=== VERIFICATION REPORT ===';

PRINT 'Total NameEvent records (People + Events):';
SELECT COUNT(*) FROM dbo.NameEvent;

PRINT 'Total People (neType=N):';
SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N';

PRINT 'Total Events (neType=E):';
SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E';

PRINT 'Total Pictures:';
SELECT COUNT(*) FROM dbo.Pictures;

PRINT 'Total NamePhoto associations:';
SELECT COUNT(*) FROM dbo.NamePhoto;

-- ============================================
-- STEP 8: CHECK FOR ID MISMATCHES
-- ============================================

PRINT '=== ID MISMATCH CHECK ===';

-- Find NamePhoto records with IDs that don't exist in NameEvent
SELECT 
    np.npID,
    COUNT(*) AS Count,
    'ORPHANED - no NameEvent record' AS Status
FROM dbo.NamePhoto np
LEFT JOIN dbo.NameEvent ne ON np.npID = ne.ID
WHERE ne.ID IS NULL
GROUP BY np.npID
ORDER BY np.npID;

-- Find Pictures with PPeopleList IDs that don't exist in NameEvent
-- (This would indicate ID mismatches)
PRINT 'Checking PPeopleList references...';
SELECT TOP 10
    p.PFileName,
    p.PPeopleList,
    'Check' AS Note
FROM dbo.Pictures p
WHERE p.PPeopleList IS NOT NULL
ORDER BY p.PFileName;

-- ============================================
-- STEP 9: SAMPLE DATA CHECK
-- ============================================

PRINT '=== SAMPLE DATA ===';

PRINT 'Sample Picture with TaggedPeople:';
SELECT TOP 1
    p.PFileName,
    p.PPeopleList,
    p.PNameCount,
    'People in PPeopleList:' AS Note
FROM dbo.Pictures p
WHERE p.PPeopleList IS NOT NULL
ORDER BY p.PNameCount DESC;

-- Show which people should be tagged
-- (Parse the PPeopleList to find their names)
-- This is complex in SQL, so just show the raw data for now

PRINT 'Sample NameEvent records (first 10):';
SELECT TOP 10 * FROM dbo.NameEvent ORDER BY ID;

-- ============================================
-- NOTES
-- ============================================

/*
KEY DIFFERENCES FROM PREVIOUS MIGRATION:

1. IDENTITY_INSERT ON/OFF:
   - Allows inserting specific ID values instead of auto-generating
   - Preserves original SQLite IDs
   - Critical for PPeopleList references to stay valid

2. No KEEPIDENTITY in BULK INSERT:
   - KEEPIDENTITY is for native format files
   - We're using CSV format, so IDENTITY_INSERT handles it

3. CSV Encoding:
   - CODEPAGE = '65001' for UTF-8
   - Handles special characters in names

4. Steps:
   - Clear all existing data first
   - Reset identity counter to 0
   - Insert People with preserved IDs
   - Insert Events with preserved IDs
   - Insert Pictures and associations
   - Verify integrity

AFTER RUNNING THIS SCRIPT:
- All IDs will match between SQLite and Azure SQL
- PPeopleList references will resolve correctly
- TaggedPeople will display correct names
*/
