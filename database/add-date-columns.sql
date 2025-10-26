-- Add month and year columns to UnindexedFiles table
-- for storing extracted EXIF/metadata dates

-- Check if columns already exist and add them if they don't
IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.UnindexedFiles') 
    AND name = 'uiMonth'
)
BEGIN
    ALTER TABLE dbo.UnindexedFiles
    ADD uiMonth INT NULL;
    PRINT 'Added column uiMonth to UnindexedFiles';
END
ELSE
BEGIN
    PRINT 'Column uiMonth already exists in UnindexedFiles';
END

IF NOT EXISTS (
    SELECT 1 FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.UnindexedFiles') 
    AND name = 'uiYear'
)
BEGIN
    ALTER TABLE dbo.UnindexedFiles
    ADD uiYear INT NULL;
    PRINT 'Added column uiYear to UnindexedFiles';
END
ELSE
BEGIN
    PRINT 'Column uiYear already exists in UnindexedFiles';
END

GO

PRINT 'Migration complete: UnindexedFiles now has uiMonth and uiYear columns';
