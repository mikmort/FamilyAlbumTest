-- Face Recognition Schema
-- This schema adds support for automatic face detection and recognition

-- Table to store face encodings extracted from photos
CREATE TABLE dbo.FaceEncodings (
    FaceID INT IDENTITY(1,1) PRIMARY KEY,
    PFileName NVARCHAR(255) NOT NULL,
    PersonID INT NULL, -- NULL for unidentified faces
    Encoding VARBINARY(MAX) NOT NULL, -- 128D float array stored as binary
    BoundingBox NVARCHAR(MAX) NULL, -- JSON: {"top": 100, "right": 200, "bottom": 300, "left": 150}
    Confidence FLOAT NULL, -- Confidence score of the match (0.0 to 1.0)
    Distance FLOAT NULL, -- Distance metric from comparison (lower is better match)
    IsConfirmed BIT DEFAULT 0, -- Whether user has confirmed this match
    IsRejected BIT DEFAULT 0, -- Whether user has rejected this suggestion
    CreatedDate DATETIME2 DEFAULT GETDATE(),
    UpdatedDate DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT FK_FaceEncodings_Pictures FOREIGN KEY (PFileName) 
        REFERENCES dbo.Pictures(PFileName) ON DELETE CASCADE,
    CONSTRAINT FK_FaceEncodings_People FOREIGN KEY (PersonID) 
        REFERENCES dbo.NameEvent(NameID) ON DELETE SET NULL
);

-- Index for looking up faces by photo
CREATE INDEX IDX_FaceEncodings_PFileName ON dbo.FaceEncodings(PFileName);

-- Index for looking up faces by person
CREATE INDEX IDX_FaceEncodings_PersonID ON dbo.FaceEncodings(PersonID);

-- Index for finding unconfirmed faces
CREATE INDEX IDX_FaceEncodings_IsConfirmed ON dbo.FaceEncodings(IsConfirmed, PersonID);

-- Table to store aggregate person encodings (for faster matching)
CREATE TABLE dbo.PersonEncodings (
    EncodingID INT IDENTITY(1,1) PRIMARY KEY,
    PersonID INT NOT NULL,
    AggregateEncoding VARBINARY(MAX) NOT NULL, -- Average or representative encoding
    EncodingCount INT DEFAULT 0, -- Number of face samples used
    LastUpdated DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT FK_PersonEncodings_People FOREIGN KEY (PersonID) 
        REFERENCES dbo.NameEvent(NameID) ON DELETE CASCADE,
    CONSTRAINT UQ_PersonEncodings_PersonID UNIQUE (PersonID)
);

-- View to get face detection statistics
CREATE VIEW dbo.vw_FaceDetectionStats AS
SELECT 
    p.PFileName,
    p.PDescription,
    p.PDate,
    COUNT(f.FaceID) as TotalFaces,
    SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 1 THEN 1 ELSE 0 END) as ConfirmedFaces,
    SUM(CASE WHEN f.PersonID IS NOT NULL AND f.IsConfirmed = 0 THEN 1 ELSE 0 END) as SuggestedFaces,
    SUM(CASE WHEN f.PersonID IS NULL THEN 1 ELSE 0 END) as UnidentifiedFaces
FROM dbo.Pictures p
LEFT JOIN dbo.FaceEncodings f ON p.PFileName = f.PFileName
GROUP BY p.PFileName, p.PDescription, p.PDate;
GO

-- Stored procedure to confirm a face match
CREATE PROCEDURE dbo.sp_ConfirmFaceMatch
    @FaceID INT,
    @PersonID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    BEGIN TRANSACTION;
    
    -- Update the face encoding
    UPDATE dbo.FaceEncodings
    SET PersonID = @PersonID,
        IsConfirmed = 1,
        IsRejected = 0,
        UpdatedDate = GETDATE()
    WHERE FaceID = @FaceID;
    
    -- Add to NamePhoto if not already exists
    DECLARE @PFileName NVARCHAR(255);
    SELECT @PFileName = PFileName FROM dbo.FaceEncodings WHERE FaceID = @FaceID;
    
    IF NOT EXISTS (SELECT 1 FROM dbo.NamePhoto WHERE NameID = @PersonID AND PFileName = @PFileName)
    BEGIN
        INSERT INTO dbo.NamePhoto (NameID, PFileName)
        VALUES (@PersonID, @PFileName);
    END
    
    -- Update pNameCount in Pictures table
    UPDATE dbo.Pictures
    SET pNameCount = (
        SELECT COUNT(DISTINCT NameID)
        FROM dbo.NamePhoto
        WHERE PFileName = @PFileName
    )
    WHERE PFileName = @PFileName;
    
    COMMIT TRANSACTION;
END;
GO

-- Stored procedure to reject a face match suggestion
CREATE PROCEDURE dbo.sp_RejectFaceMatch
    @FaceID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.FaceEncodings
    SET PersonID = NULL,
        IsConfirmed = 0,
        IsRejected = 1,
        UpdatedDate = GETDATE()
    WHERE FaceID = @FaceID;
END;
GO

-- Stored procedure to get faces needing review
CREATE PROCEDURE dbo.sp_GetFacesForReview
    @Limit INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP (@Limit)
        f.FaceID,
        f.PFileName,
        f.PersonID,
        ne.NName as SuggestedPersonName,
        f.BoundingBox,
        f.Confidence,
        f.Distance,
        f.CreatedDate
    FROM dbo.FaceEncodings f
    LEFT JOIN dbo.NameEvent ne ON f.PersonID = ne.NameID
    WHERE f.IsConfirmed = 0 
        AND f.IsRejected = 0
        AND f.PersonID IS NOT NULL  -- Only show faces with suggestions
    ORDER BY f.Confidence DESC, f.CreatedDate DESC;
END;
GO

PRINT 'Face Recognition schema created successfully';
