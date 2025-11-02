-- User Permissions and Access Control Schema
-- Created: 2025-11-02

-- Drop table if exists
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO

-- Users table for permission management
CREATE TABLE dbo.Users (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Role NVARCHAR(50) NOT NULL CHECK (Role IN ('Admin', 'Full', 'Read')),
    Status NVARCHAR(50) NOT NULL DEFAULT 'Active' CHECK (Status IN ('Active', 'Pending', 'Denied', 'Suspended')),
    RequestedAt DATETIME2 DEFAULT GETDATE(),
    ApprovedAt DATETIME2 NULL,
    ApprovedBy NVARCHAR(255) NULL,
    LastLoginAt DATETIME2 NULL,
    Notes NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    UpdatedAt DATETIME2 DEFAULT GETDATE(),
    INDEX IX_Users_Email (Email),
    INDEX IX_Users_Status (Status),
    INDEX IX_Users_Role (Role)
);
GO

-- Trigger to update UpdatedAt
CREATE TRIGGER TR_Users_UpdateModifiedDate
ON dbo.Users
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Users
    SET UpdatedAt = GETDATE()
    FROM dbo.Users u
    INNER JOIN inserted i ON u.ID = i.ID;
END;
GO

-- Insert initial admin users
INSERT INTO dbo.Users (Email, Role, Status, ApprovedAt, ApprovedBy, Notes)
VALUES 
    ('mikmort@hotmail.com', 'Admin', 'Active', GETDATE(), 'System', 'Initial admin user'),
    ('mikmort@gmail.com', 'Admin', 'Active', GETDATE(), 'System', 'Initial admin user'),
    ('jb_morton@live.com', 'Admin', 'Active', GETDATE(), 'System', 'Initial admin user');
GO

-- View active users by role
CREATE VIEW vw_ActiveUsersByRole AS
SELECT 
    Role,
    COUNT(*) as UserCount,
    STRING_AGG(Email, ', ') as Users
FROM dbo.Users
WHERE Status = 'Active'
GROUP BY Role;
GO

-- View pending access requests
CREATE VIEW vw_PendingAccessRequests AS
SELECT 
    ID,
    Email,
    RequestedAt,
    DATEDIFF(HOUR, RequestedAt, GETDATE()) as HoursSinceRequest,
    Notes
FROM dbo.Users
WHERE Status = 'Pending'
ORDER BY RequestedAt ASC;
GO

PRINT 'User permissions schema created successfully!';
PRINT '';
PRINT 'Initial admin users:';
SELECT Email, Role, Status, CreatedAt FROM dbo.Users;
