-- Family Album Database Schema for Azure SQL Database
-- Version 1.0 - October 14, 2025

-- Drop tables if they exist (for clean setup)
IF OBJECT_ID('dbo.NamePhoto', 'U') IS NOT NULL DROP TABLE dbo.NamePhoto;
IF OBJECT_ID('dbo.UnindexedFiles', 'U') IS NOT NULL DROP TABLE dbo.UnindexedFiles;
IF OBJECT_ID('dbo.Pictures', 'U') IS NOT NULL DROP TABLE dbo.Pictures;
IF OBJECT_ID('dbo.NameEvent', 'U') IS NOT NULL DROP TABLE dbo.NameEvent;
GO

-- Table: NameEvent
-- Stores both People (neType='N') and Events (neType='E')
CREATE TABLE dbo.NameEvent (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    neName NVARCHAR(255) NOT NULL,
    neRelation NVARCHAR(500),
    neType CHAR(1) NOT NULL CHECK (neType IN ('N', 'E')),
    neDateLastModified DATETIME2 DEFAULT GETDATE(),
    neCount INT DEFAULT 0,
    INDEX IX_NameEvent_Type (neType),
    INDEX IX_NameEvent_Name (neName)
);
GO

-- Table: Pictures
-- Stores metadata for all photos and videos
CREATE TABLE dbo.Pictures (
    PFileName NVARCHAR(500) PRIMARY KEY,
    PFileDirectory NVARCHAR(1000),
    PDescription NVARCHAR(MAX),
    PHeight INT,
    PWidth INT,
    PMonth INT CHECK (PMonth >= 1 AND PMonth <= 12),
    PYear INT CHECK (PYear >= 1900 AND PYear <= 2100),
    PPeopleList NVARCHAR(MAX), -- Comma-separated person IDs
    PNameCount INT DEFAULT 0,
    PThumbnailUrl NVARCHAR(1000), -- URL to thumbnail in Azure Blob Storage
    PType INT NOT NULL CHECK (PType IN (1, 2)), -- 1=image, 2=video
    PTime INT DEFAULT 0, -- Video duration in seconds
    PDateEntered DATETIME2 DEFAULT GETDATE(),
    PLastModifiedDate DATETIME2 DEFAULT GETDATE(),
    PReviewed BIT DEFAULT 0,
    PSoundFile NVARCHAR(500),
    PBlobUrl NVARCHAR(1000), -- URL to actual file in Azure Blob Storage
    INDEX IX_Pictures_Type (PType),
    INDEX IX_Pictures_YearMonth (PYear, PMonth),
    INDEX IX_Pictures_DateEntered (PDateEntered)
);
GO

-- Table: NamePhoto
-- Many-to-many relationship between People/Events and Pictures
-- Order is determined by PPeopleList in Pictures table, not by position here
CREATE TABLE dbo.NamePhoto (
    npID INT NOT NULL,
    npFileName NVARCHAR(500) NOT NULL,
    PRIMARY KEY (npID, npFileName),
    FOREIGN KEY (npID) REFERENCES dbo.NameEvent(ID) ON DELETE CASCADE,
    FOREIGN KEY (npFileName) REFERENCES dbo.Pictures(PFileName) ON DELETE CASCADE,
    INDEX IX_NamePhoto_FileName (npFileName),
    INDEX IX_NamePhoto_ID (npID)
);
GO

-- Table: UnindexedFiles
-- Staging area for new files before they are processed
CREATE TABLE dbo.UnindexedFiles (
    uiID INT IDENTITY(1,1) PRIMARY KEY,
    uiFileName NVARCHAR(1000) NOT NULL,
    uiDirectory NVARCHAR(1000),
    uiThumbUrl NVARCHAR(1000), -- URL to thumbnail in Azure Blob Storage
    uiType INT NOT NULL CHECK (uiType IN (1, 2)), -- 1=image, 2=video
    uiWidth INT,
    uiHeight INT,
    uiVtime INT DEFAULT 0, -- Video duration in seconds
    uiStatus CHAR(1) DEFAULT 'N' CHECK (uiStatus IN ('N', 'P')), -- N=new, P=processed
    uiBlobUrl NVARCHAR(1000), -- URL to actual file in Azure Blob Storage
    uiDateAdded DATETIME2 DEFAULT GETDATE(),
    INDEX IX_UnindexedFiles_Status (uiStatus)
);
GO

-- Create trigger to update LastModifiedDate on Pictures
CREATE TRIGGER TR_Pictures_UpdateModifiedDate
ON dbo.Pictures
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.Pictures
    SET PLastModifiedDate = GETDATE()
    FROM dbo.Pictures p
    INNER JOIN inserted i ON p.PFileName = i.PFileName;
END;
GO

-- Create trigger to update LastModifiedDate on NameEvent
CREATE TRIGGER TR_NameEvent_UpdateModifiedDate
ON dbo.NameEvent
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE dbo.NameEvent
    SET neDateLastModified = GETDATE()
    FROM dbo.NameEvent ne
    INNER JOIN inserted i ON ne.ID = i.ID;
END;
GO

-- Create stored procedure to update person/event counts
CREATE PROCEDURE dbo.UpdateNameEventCounts
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE ne
    SET neCount = ISNULL(cnt.MediaCount, 0)
    FROM dbo.NameEvent ne
    LEFT JOIN (
        SELECT npID, COUNT(*) as MediaCount
        FROM dbo.NamePhoto
        GROUP BY npID
    ) cnt ON ne.ID = cnt.npID;
END;
GO

-- Insert sample data (optional - for testing)
-- Uncomment to add sample people and events

-- INSERT INTO dbo.NameEvent (neName, neRelation, neType) VALUES
-- ('John Smith', 'Father', 'N'),
-- ('Jane Smith', 'Mother', 'N'),
-- ('Christmas 2024', 'Annual holiday celebration', 'E'),
-- ('Summer Vacation 2024', 'Trip to the beach', 'E');
-- GO

PRINT 'Database schema created successfully!';
PRINT 'Tables created: NameEvent, Pictures, NamePhoto, UnindexedFiles';
PRINT 'Triggers and stored procedures created.';
GO
