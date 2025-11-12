-- Add midsize image URL column to Pictures table
-- This supports progressive image loading for better performance
-- Midsize images are 1080px max dimension for files >1MB

USE FamilyAlbum;
GO

PRINT '=== Adding PMidsizeUrl column to Pictures table ==='
PRINT ''

-- Add the column to Pictures if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.Pictures') 
    AND name = 'PMidsizeUrl'
)
BEGIN
    ALTER TABLE dbo.Pictures
    ADD PMidsizeUrl nvarchar(1000) NULL;
    
    PRINT '✓ Added PMidsizeUrl column to Pictures table'
END
ELSE
BEGIN
    PRINT '⊗ PMidsizeUrl column already exists in Pictures'
END
GO

-- Add the column to UnindexedFiles if it doesn't exist
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.UnindexedFiles') 
    AND name = 'uiMidsizeUrl'
)
BEGIN
    ALTER TABLE dbo.UnindexedFiles
    ADD uiMidsizeUrl nvarchar(1000) NULL;
    
    PRINT '✓ Added uiMidsizeUrl column to UnindexedFiles table'
END
ELSE
BEGIN
    PRINT '⊗ uiMidsizeUrl column already exists in UnindexedFiles'
END
GO

-- Add index for querying by midsize URL (useful for existence checks)
IF NOT EXISTS (
    SELECT * FROM sys.indexes 
    WHERE name = 'IX_Pictures_MidsizeUrl' 
    AND object_id = OBJECT_ID('dbo.Pictures')
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_Pictures_MidsizeUrl
    ON dbo.Pictures (PMidsizeUrl)
    WHERE PMidsizeUrl IS NOT NULL;
    
    PRINT '✓ Created index IX_Pictures_MidsizeUrl'
END
ELSE
BEGIN
    PRINT '⊗ Index IX_Pictures_MidsizeUrl already exists'
END
GO

PRINT ''
PRINT '=== Migration Complete ==='
PRINT ''
PRINT 'Next steps:'
PRINT '  1. Deploy updated API code to generate midsize images'
PRINT '  2. Run backfill script to generate midsize for existing large images'
PRINT ''
GO
