-- Face Training Progress Tracking Schema
-- Allows resuming training from where it was interrupted

-- Drop existing table if it exists
IF OBJECT_ID('dbo.FaceTrainingProgress', 'U') IS NOT NULL
    DROP TABLE dbo.FaceTrainingProgress;
GO

-- Table to track training progress and allow resuming
CREATE TABLE dbo.FaceTrainingProgress (
    SessionID INT IDENTITY(1,1) PRIMARY KEY,
    StartedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    CompletedAt DATETIME2 NULL,
    Status VARCHAR(20) NOT NULL DEFAULT 'InProgress', -- InProgress, Completed, Cancelled
    TrainingType VARCHAR(20) NOT NULL, -- Baseline, Full
    TotalPersons INT NOT NULL DEFAULT 0,
    ProcessedPersons INT NOT NULL DEFAULT 0,
    TotalPhotos INT NOT NULL DEFAULT 0,
    ProcessedPhotos INT NOT NULL DEFAULT 0,
    SuccessfulFaces INT NOT NULL DEFAULT 0,
    FailedFaces INT NOT NULL DEFAULT 0,
    MaxPerPerson INT NULL, -- Only set for baseline training
    LastProcessedPerson INT NULL, -- Last person ID that was processed
    LastProcessedPhoto VARCHAR(255) NULL, -- Last photo filename that was processed
    ErrorMessage NVARCHAR(MAX) NULL,
    UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE()
);
GO

-- Index for finding the latest session
CREATE INDEX IX_FaceTrainingProgress_StartedAt 
    ON dbo.FaceTrainingProgress(StartedAt DESC);
GO

-- Index for finding incomplete sessions
CREATE INDEX IX_FaceTrainingProgress_Status 
    ON dbo.FaceTrainingProgress(Status);
GO

-- Table to track which specific photos have been processed in current session
IF OBJECT_ID('dbo.FaceTrainingPhotoProgress', 'U') IS NOT NULL
    DROP TABLE dbo.FaceTrainingPhotoProgress;
GO

CREATE TABLE dbo.FaceTrainingPhotoProgress (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    SessionID INT NOT NULL,
    PersonID INT NOT NULL,
    PersonName NVARCHAR(100) NOT NULL,
    PFileName VARCHAR(255) NOT NULL,
    ProcessedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
    Success BIT NOT NULL,
    ErrorMessage NVARCHAR(MAX) NULL,
    FOREIGN KEY (SessionID) REFERENCES dbo.FaceTrainingProgress(SessionID) ON DELETE CASCADE
);
GO

-- Index for finding processed photos in a session
CREATE INDEX IX_FaceTrainingPhotoProgress_Session 
    ON dbo.FaceTrainingPhotoProgress(SessionID, PersonID);
GO

-- Stored procedure to start a new training session
IF OBJECT_ID('dbo.sp_StartTrainingSession', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_StartTrainingSession;
GO

CREATE PROCEDURE dbo.sp_StartTrainingSession
    @TrainingType VARCHAR(20),
    @MaxPerPerson INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    -- Cancel any existing InProgress sessions (they're stale)
    UPDATE dbo.FaceTrainingProgress
    SET Status = 'Cancelled',
        UpdatedAt = GETDATE()
    WHERE Status = 'InProgress';
    
    -- Create new session
    INSERT INTO dbo.FaceTrainingProgress (TrainingType, MaxPerPerson)
    VALUES (@TrainingType, @MaxPerPerson);
    
    -- Return the new session ID
    SELECT SCOPE_IDENTITY() as SessionID;
END;
GO

-- Stored procedure to update training progress
IF OBJECT_ID('dbo.sp_UpdateTrainingProgress', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_UpdateTrainingProgress;
GO

CREATE PROCEDURE dbo.sp_UpdateTrainingProgress
    @SessionID INT,
    @TotalPersons INT = NULL,
    @ProcessedPersons INT = NULL,
    @TotalPhotos INT = NULL,
    @ProcessedPhotos INT = NULL,
    @SuccessfulFaces INT = NULL,
    @FailedFaces INT = NULL,
    @LastProcessedPerson INT = NULL,
    @LastProcessedPhoto VARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.FaceTrainingProgress
    SET 
        TotalPersons = ISNULL(@TotalPersons, TotalPersons),
        ProcessedPersons = ISNULL(@ProcessedPersons, ProcessedPersons),
        TotalPhotos = ISNULL(@TotalPhotos, TotalPhotos),
        ProcessedPhotos = ISNULL(@ProcessedPhotos, ProcessedPhotos),
        SuccessfulFaces = ISNULL(@SuccessfulFaces, SuccessfulFaces),
        FailedFaces = ISNULL(@FailedFaces, FailedFaces),
        LastProcessedPerson = ISNULL(@LastProcessedPerson, LastProcessedPerson),
        LastProcessedPhoto = ISNULL(@LastProcessedPhoto, LastProcessedPhoto),
        UpdatedAt = GETDATE()
    WHERE SessionID = @SessionID;
END;
GO

-- Stored procedure to record photo processing
IF OBJECT_ID('dbo.sp_RecordPhotoProgress', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_RecordPhotoProgress;
GO

CREATE PROCEDURE dbo.sp_RecordPhotoProgress
    @SessionID INT,
    @PersonID INT,
    @PersonName NVARCHAR(100),
    @PFileName VARCHAR(255),
    @Success BIT,
    @ErrorMessage NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    INSERT INTO dbo.FaceTrainingPhotoProgress 
        (SessionID, PersonID, PersonName, PFileName, Success, ErrorMessage)
    VALUES 
        (@SessionID, @PersonID, @PersonName, @PFileName, @Success, @ErrorMessage);
END;
GO

-- Stored procedure to complete training session
IF OBJECT_ID('dbo.sp_CompleteTrainingSession', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_CompleteTrainingSession;
GO

CREATE PROCEDURE dbo.sp_CompleteTrainingSession
    @SessionID INT,
    @Status VARCHAR(20) = 'Completed', -- Completed or Cancelled
    @ErrorMessage NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    
    UPDATE dbo.FaceTrainingProgress
    SET 
        Status = @Status,
        CompletedAt = GETDATE(),
        ErrorMessage = @ErrorMessage,
        UpdatedAt = GETDATE()
    WHERE SessionID = @SessionID;
END;
GO

-- Stored procedure to get latest incomplete session (for resuming)
IF OBJECT_ID('dbo.sp_GetIncompleteTrainingSession', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetIncompleteTrainingSession;
GO

CREATE PROCEDURE dbo.sp_GetIncompleteTrainingSession
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT TOP 1
        SessionID,
        StartedAt,
        TrainingType,
        MaxPerPerson,
        TotalPersons,
        ProcessedPersons,
        TotalPhotos,
        ProcessedPhotos,
        SuccessfulFaces,
        FailedFaces,
        LastProcessedPerson,
        LastProcessedPhoto
    FROM dbo.FaceTrainingProgress
    WHERE Status = 'InProgress'
        AND DATEDIFF(HOUR, UpdatedAt, GETDATE()) < 24 -- Only resume if less than 24 hours old
    ORDER BY StartedAt DESC;
END;
GO

-- Stored procedure to get processed photos for current session (for skip logic)
IF OBJECT_ID('dbo.sp_GetProcessedPhotosInSession', 'P') IS NOT NULL
    DROP PROCEDURE dbo.sp_GetProcessedPhotosInSession;
GO

CREATE PROCEDURE dbo.sp_GetProcessedPhotosInSession
    @SessionID INT
AS
BEGIN
    SET NOCOUNT ON;
    
    SELECT DISTINCT PFileName
    FROM dbo.FaceTrainingPhotoProgress
    WHERE SessionID = @SessionID
        AND Success = 1; -- Only return successfully processed photos
END;
GO

PRINT 'Face Training Progress schema created successfully';
