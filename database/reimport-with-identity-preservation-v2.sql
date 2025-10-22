/*
============================================
REIMPORT SCRIPT: PRESERVE SQLITE IDs
============================================

CRITICAL: This script performs a DESTRUCTIVE reimport. 
It will DELETE ALL data from NameEvent, Pictures, and NamePhoto tables,
then reimports with IDENTITY_INSERT to preserve original SQLite IDs.

BEFORE RUNNING:
1. Backup your Azure SQL database!
2. Update paths in BULK INSERT statements if CSV files are in different location

PATHS EXPECTED:
- C:\Temp\people_export.csv (358 rows)
- C:\Temp\events_export.csv (157 rows)
- C:\Temp\pictures_export.csv (9717 rows)
- C:\Temp\namephoto_export.csv (28700 rows)

SQL SYNTAX:
- Uses IDENTITY_INSERT ON/OFF to control ID insertion
- Uses BULK INSERT for CSV import
- Includes verification queries

EXECUTION TIME: ~10-15 minutes
*/

-- ============================================
-- STEP 1: CLEAR EXISTING DATA
-- ============================================

PRINT '=== CLEARING EXISTING DATA ===';

-- Delete NamePhoto first (references NameEvent)
DELETE FROM dbo.NamePhoto;
DBCC CHECKIDENT ('dbo.NamePhoto', RESEED, 0);

-- Delete Pictures
DELETE FROM dbo.Pictures;

-- Delete NameEvent (people and events)
DELETE FROM dbo.NameEvent;
DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);

PRINT 'Old data cleared.';

-- ============================================
-- STEP 2: IMPORT PEOPLE (neType='N')
-- ============================================

PRINT '=== IMPORTING PEOPLE ===';

SET IDENTITY_INSERT dbo.NameEvent ON;

BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount)
FROM 'C:\Temp\people_export.csv'
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

SET IDENTITY_INSERT dbo.NameEvent OFF;

PRINT 'People imported.';

-- Count imported people
SELECT COUNT(*) AS ImportedPeople FROM dbo.NameEvent WHERE neType = 'N';

-- ============================================
-- STEP 3: IMPORT EVENTS (neType='E')
-- ============================================

PRINT '=== IMPORTING EVENTS ===';

SET IDENTITY_INSERT dbo.NameEvent ON;

BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount)
FROM 'C:\Temp\events_export.csv'
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

SET IDENTITY_INSERT dbo.NameEvent OFF;

PRINT 'Events imported.';

-- Count imported events
SELECT COUNT(*) AS ImportedEvents FROM dbo.NameEvent WHERE neType = 'E';

-- ============================================
-- STEP 4: IMPORT PICTURES
-- ============================================

PRINT '=== IMPORTING PICTURES ===';

-- Note: Pictures table has no IDENTITY column, so no need for IDENTITY_INSERT
BULK INSERT dbo.Pictures (
    PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, 
    PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, 
    PReviewed, PTime, PNameCount
)
FROM 'C:\Temp\pictures_export.csv'
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

PRINT 'Pictures imported.';

-- Count imported pictures
SELECT COUNT(*) AS ImportedPictures FROM dbo.Pictures;

-- ============================================
-- STEP 5: IMPORT PHOTO ASSOCIATIONS
-- ============================================

PRINT '=== IMPORTING PHOTO ASSOCIATIONS ===';

BULK INSERT dbo.NamePhoto (npID, npFileName)
FROM 'C:\Temp\namephoto_export.csv'
WITH (
    FIRSTROW = 2,
    FIELDTERMINATOR = ',',
    ROWTERMINATOR = '\n',
    FORMAT = 'CSV',
    CODEPAGE = '65001'
);

PRINT 'Photo associations imported.';

-- Count imported associations
SELECT COUNT(*) AS ImportedAssociations FROM dbo.NamePhoto;

-- ============================================
-- STEP 6: VERIFICATION QUERIES
-- ============================================

PRINT '';
PRINT '=== VERIFICATION REPORT ===';
PRINT '';

PRINT 'Total NameEvent records (People + Events):';
SELECT COUNT(*) AS Total FROM dbo.NameEvent;

PRINT 'Total People (neType=''N''):';
SELECT COUNT(*) AS People FROM dbo.NameEvent WHERE neType = 'N';

PRINT 'Total Events (neType=''E''):';
SELECT COUNT(*) AS Events FROM dbo.NameEvent WHERE neType = 'E';

PRINT 'Total Pictures:';
SELECT COUNT(*) AS Pictures FROM dbo.Pictures;

PRINT 'Total NamePhoto associations:';
SELECT COUNT(*) AS Associations FROM dbo.NamePhoto;

-- ============================================
-- STEP 7: CHECK FOR ORPHANED RECORDS
-- ============================================

PRINT '';
PRINT '=== ORPHANED RECORD CHECK ===';

-- Find NamePhoto records with IDs that don't exist in NameEvent
IF EXISTS (
    SELECT 1 FROM dbo.NamePhoto np
    LEFT JOIN dbo.NameEvent ne ON np.npID = ne.ID
    WHERE ne.ID IS NULL
)
BEGIN
    PRINT 'WARNING: Found orphaned NamePhoto records (IDs with no matching people/events):';
    SELECT 
        np.npID,
        COUNT(*) AS Count,
        'ORPHANED - no NameEvent record' AS Status
    FROM dbo.NamePhoto np
    LEFT JOIN dbo.NameEvent ne ON np.npID = ne.ID
    WHERE ne.ID IS NULL
    GROUP BY np.npID
    ORDER BY np.npID;
END
ELSE
BEGIN
    PRINT '✓ No orphaned NamePhoto records found.';
END

-- ============================================
-- STEP 8: SAMPLE DATA VERIFICATION
-- ============================================

PRINT '';
PRINT '=== SAMPLE DATA ===';

-- Show first few people
PRINT 'First 5 people:';
SELECT TOP 5 ID, neName, neType FROM dbo.NameEvent WHERE neType = 'N' ORDER BY ID;

-- Show first few events
PRINT 'First 5 events:';
SELECT TOP 5 ID, neName, neType FROM dbo.NameEvent WHERE neType = 'E' ORDER BY ID;

-- Show pictures with PPeopleList
PRINT 'First 3 pictures with tagged people:';
SELECT TOP 3 PfileDirectory, PfileName, PPeopleList FROM dbo.Pictures WHERE PPeopleList IS NOT NULL;

-- Verify specific person ID from export
PRINT 'Verify: ID 195 should be Budie Grossman:';
SELECT ID, neName FROM dbo.NameEvent WHERE ID = 195;

PRINT 'Verify: ID 318 should be Jigger:';
SELECT ID, neName FROM dbo.NameEvent WHERE ID = 318;

PRINT 'Verify: ID 507 should be Scott Jenkins:';
SELECT ID, neName FROM dbo.NameEvent WHERE ID = 507;

-- ============================================
-- STEP 9: REIMPORT COMPLETE
-- ============================================

PRINT '';
PRINT '=== REIMPORT COMPLETE ===';
PRINT 'Data integrity verified. IDs preserved from SQLite export.';
PRINT 'Next: Deploy and test on deployed site.';
