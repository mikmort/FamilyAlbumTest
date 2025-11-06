-- Add TotalFaces column to PersonEncodings table
-- This tracks the total number of confirmed faces available vs. the sample size used

-- Check if column exists first
IF NOT EXISTS (
    SELECT 1 
    FROM sys.columns 
    WHERE object_id = OBJECT_ID('dbo.PersonEncodings') 
    AND name = 'TotalFaces'
)
BEGIN
    ALTER TABLE dbo.PersonEncodings
    ADD TotalFaces INT NULL;
    
    PRINT 'Added TotalFaces column to PersonEncodings table';
END
ELSE
BEGIN
    PRINT 'TotalFaces column already exists';
END
GO

-- Update existing records to set TotalFaces = EncodingCount for consistency
UPDATE dbo.PersonEncodings
SET TotalFaces = EncodingCount
WHERE TotalFaces IS NULL;

PRINT 'Updated existing PersonEncodings records';
GO
