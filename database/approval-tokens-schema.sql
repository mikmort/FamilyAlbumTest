-- Approval Tokens Table for email-based user approval
-- Stores secure tokens for approving/denying access via email links

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'ApprovalTokens')
BEGIN
    CREATE TABLE dbo.ApprovalTokens (
        ID INT IDENTITY(1,1) PRIMARY KEY,
        Token NVARCHAR(255) NOT NULL UNIQUE,
        UserID INT NOT NULL,
        Action NVARCHAR(50) NOT NULL CHECK (Action IN ('FullAccess', 'ReadOnly', 'Deny')),
        CreatedAt DATETIME2 DEFAULT GETDATE(),
        ExpiresAt DATETIME2 NOT NULL,
        UsedAt DATETIME2 NULL,
        UsedBy NVARCHAR(255) NULL,
        
        FOREIGN KEY (UserID) REFERENCES dbo.Users(ID) ON DELETE CASCADE,
        INDEX IX_ApprovalTokens_Token (Token),
        INDEX IX_ApprovalTokens_ExpiresAt (ExpiresAt)
    );
END
GO

-- Cleanup trigger to delete expired tokens older than 30 days
-- This helps maintain database cleanliness
CREATE OR ALTER TRIGGER TR_CleanupExpiredTokens
ON dbo.ApprovalTokens
AFTER INSERT
AS
BEGIN
    DELETE FROM dbo.ApprovalTokens
    WHERE ExpiresAt < DATEADD(DAY, -30, GETDATE())
    AND UsedAt IS NULL;
END
GO
