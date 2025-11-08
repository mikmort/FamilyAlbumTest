-- Create table to track when users last viewed the "New Media" section
-- This allows showing each user only media that's new since their last visit

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[UserLastViewed]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[UserLastViewed] (
        [userId] INT IDENTITY(1,1) PRIMARY KEY,
        [userEmail] NVARCHAR(255) NOT NULL UNIQUE,
        [lastViewedTime] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [createdAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
        [updatedAt] DATETIME2 NOT NULL DEFAULT GETUTCDATE()
    );
    
    -- Index for fast lookup by email
    CREATE INDEX IX_UserLastViewed_Email ON [dbo].[UserLastViewed]([userEmail]);
    
    PRINT 'Created UserLastViewed table';
END
ELSE
BEGIN
    PRINT 'UserLastViewed table already exists';
END
GO
