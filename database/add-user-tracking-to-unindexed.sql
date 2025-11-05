-- Add user tracking to UnindexedFiles table
-- This allows multiple users to upload simultaneously without mixing their files

-- Add column for user email (who uploaded the file)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.UnindexedFiles') AND name = 'uiUploadedBy')
BEGIN
    ALTER TABLE dbo.UnindexedFiles
    ADD uiUploadedBy NVARCHAR(255) NULL;
    
    PRINT 'Added uiUploadedBy column to UnindexedFiles table';
END
ELSE
BEGIN
    PRINT 'uiUploadedBy column already exists';
END

-- Create index for filtering by user
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_UnindexedFiles_UploadedBy' AND object_id = OBJECT_ID('dbo.UnindexedFiles'))
BEGIN
    CREATE INDEX IX_UnindexedFiles_UploadedBy ON dbo.UnindexedFiles(uiUploadedBy);
    PRINT 'Created index IX_UnindexedFiles_UploadedBy';
END
ELSE
BEGIN
    PRINT 'Index IX_UnindexedFiles_UploadedBy already exists';
END

GO

PRINT 'Migration completed successfully!';
