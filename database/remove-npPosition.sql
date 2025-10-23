-- Migration script to remove npPosition column from NamePhoto table
-- npPosition was never properly utilized; PPeopleList in Pictures table is the source of truth

-- Check if column exists and remove it
IF EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'NamePhoto' AND COLUMN_NAME = 'npPosition'
)
BEGIN
    ALTER TABLE dbo.NamePhoto DROP COLUMN npPosition;
    PRINT 'Successfully removed npPosition column from dbo.NamePhoto';
END
ELSE
BEGIN
    PRINT 'npPosition column does not exist or has already been removed';
END
GO
