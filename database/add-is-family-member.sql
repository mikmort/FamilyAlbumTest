/*
 * Add IsFamilyMember field to NameEvent table
 * 
 * This field distinguishes family members from acquaintances/friends
 * Default value is 0 (false), can be updated for each person
 * Automatically set to true for anyone with last name 'Morton'
 */

-- Add IsFamilyMember column for people (neType='N')
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'NameEvent' AND COLUMN_NAME = 'IsFamilyMember')
BEGIN
    ALTER TABLE dbo.NameEvent
    ADD IsFamilyMember BIT NOT NULL DEFAULT 0;
    PRINT 'Added IsFamilyMember column to NameEvent table';
END
ELSE
BEGIN
    PRINT 'IsFamilyMember column already exists';
END
GO

-- Create index on IsFamilyMember for efficient filtering
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NameEvent_IsFamilyMember')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NameEvent_IsFamilyMember
    ON dbo.NameEvent(IsFamilyMember) 
    WHERE neType = 'N' AND IsFamilyMember = 1;
    PRINT 'Added index IX_NameEvent_IsFamilyMember';
END
ELSE
BEGIN
    PRINT 'Index IX_NameEvent_IsFamilyMember already exists';
END
GO

-- Add extended property description
IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('NameEvent') 
    AND minor_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('NameEvent') AND name = 'IsFamilyMember')
)
BEGIN
    EXEC sys.sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Indicates whether this person is a family member (1) or acquaintance/friend (0)', 
        @level0type = N'SCHEMA', @level0name = N'dbo',
        @level1type = N'TABLE', @level1name = N'NameEvent',
        @level2type = N'COLUMN', @level2name = N'IsFamilyMember';
    PRINT 'Added description for IsFamilyMember column';
END
GO

-- Automatically set IsFamilyMember = 1 for anyone with last name 'Morton'
UPDATE dbo.NameEvent
SET IsFamilyMember = 1
WHERE neType = 'N' 
    AND (neName LIKE '% Morton' OR neName LIKE 'Morton %' OR neName = 'Morton');
PRINT 'Set IsFamilyMember = 1 for all Morton family members';
GO

-- Show summary of family members
SELECT 
    COUNT(*) AS TotalPeople,
    SUM(CASE WHEN IsFamilyMember = 1 THEN 1 ELSE 0 END) AS FamilyMembers,
    SUM(CASE WHEN IsFamilyMember = 0 THEN 1 ELSE 0 END) AS NonFamilyMembers
FROM dbo.NameEvent
WHERE neType = 'N';
GO

PRINT 'IsFamilyMember column added and initialized successfully';
