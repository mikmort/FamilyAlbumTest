-- Add Date field to events and Birthday to people
-- This helps organize events chronologically and track birthdays

-- Add EventDate column for events (neType='E')
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'NameEvent' AND COLUMN_NAME = 'EventDate')
BEGIN
    ALTER TABLE NameEvent
    ADD EventDate DATE NULL;
    PRINT 'Added EventDate column to NameEvent table';
END
ELSE
BEGIN
    PRINT 'EventDate column already exists';
END
GO

-- Add Birthday column for people (neType='N')
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'NameEvent' AND COLUMN_NAME = 'Birthday')
BEGIN
    ALTER TABLE NameEvent
    ADD Birthday DATE NULL;
    PRINT 'Added Birthday column to NameEvent table';
END
ELSE
BEGIN
    PRINT 'Birthday column already exists';
END
GO

-- Add indexes for efficient date queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NameEvent_EventDate')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NameEvent_EventDate
    ON NameEvent(EventDate) WHERE neType = 'E' AND EventDate IS NOT NULL;
    PRINT 'Added index IX_NameEvent_EventDate';
END
ELSE
BEGIN
    PRINT 'Index IX_NameEvent_EventDate already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_NameEvent_Birthday')
BEGIN
    CREATE NONCLUSTERED INDEX IX_NameEvent_Birthday
    ON NameEvent(Birthday) WHERE neType = 'N' AND Birthday IS NOT NULL;
    PRINT 'Added index IX_NameEvent_Birthday';
END
ELSE
BEGIN
    PRINT 'Index IX_NameEvent_Birthday already exists';
END
GO

-- Add extended properties for documentation
IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('NameEvent') 
    AND name = 'MS_Description' 
    AND minor_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('NameEvent') AND name = 'EventDate')
)
BEGIN
    EXEC sys.sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Date when the event occurred. Only applicable for events (neType=E). Used for chronological sorting and date-based filtering.', 
        @level0type = N'SCHEMA', @level0name = N'dbo', 
        @level1type = N'TABLE', @level1name = N'NameEvent',
        @level2type = N'COLUMN', @level2name = N'EventDate';
    PRINT 'Added description for EventDate column';
END
GO

IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('NameEvent') 
    AND name = 'MS_Description' 
    AND minor_id = (SELECT column_id FROM sys.columns WHERE object_id = OBJECT_ID('NameEvent') AND name = 'Birthday')
)
BEGIN
    EXEC sys.sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Birthday of the person. Only applicable for people (neType=N). Used for birthday reminders and age calculations.', 
        @level0type = N'SCHEMA', @level0name = N'dbo', 
        @level1type = N'TABLE', @level1name = N'NameEvent',
        @level2type = N'COLUMN', @level2name = N'Birthday';
    PRINT 'Added description for Birthday column';
END
GO

PRINT '';
PRINT '✅ Migration completed successfully!';
PRINT 'EventDate and Birthday columns added to NameEvent table';
PRINT 'Use the inference script to populate dates based on photo metadata';
GO
