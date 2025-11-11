-- Add support for InsightFace 512-dim embeddings alongside face-api.js 128-dim
-- This allows gradual migration and A/B testing between models

-- Step 1: Add columns as nullable first
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'FaceEmbeddings' AND COLUMN_NAME = 'ModelVersion')
BEGIN
    ALTER TABLE FaceEmbeddings
    ADD ModelVersion VARCHAR(50) NULL;
    PRINT 'Added ModelVersion column';
END
ELSE
BEGIN
    PRINT 'ModelVersion column already exists';
END
GO

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'FaceEmbeddings' AND COLUMN_NAME = 'EmbeddingDimensions')
BEGIN
    ALTER TABLE FaceEmbeddings
    ADD EmbeddingDimensions INT NULL;
    PRINT 'Added EmbeddingDimensions column';
END
ELSE
BEGIN
    PRINT 'EmbeddingDimensions column already exists';
END
GO

-- Step 2: Update existing rows to mark them as face-api.js embeddings
UPDATE FaceEmbeddings
SET 
    ModelVersion = 'face-api-js',
    EmbeddingDimensions = 128
WHERE ModelVersion IS NULL;
PRINT 'Updated existing embeddings to face-api-js (128-dim)';
GO

-- Step 3: Make the columns NOT NULL after populating existing data
ALTER TABLE FaceEmbeddings
ALTER COLUMN ModelVersion VARCHAR(50) NOT NULL;
PRINT 'Made ModelVersion NOT NULL';
GO

ALTER TABLE FaceEmbeddings
ALTER COLUMN EmbeddingDimensions INT NOT NULL;
PRINT 'Made EmbeddingDimensions NOT NULL';
GO

-- Step 4: Add default constraints for new rows (if they don't exist)
IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_FaceEmbeddings_ModelVersion')
BEGIN
    ALTER TABLE FaceEmbeddings
    ADD CONSTRAINT DF_FaceEmbeddings_ModelVersion 
        DEFAULT 'insightface-arcface' FOR ModelVersion;
    PRINT 'Added default constraint for ModelVersion';
END
ELSE
BEGIN
    PRINT 'Default constraint for ModelVersion already exists';
END
GO

IF NOT EXISTS (SELECT * FROM sys.default_constraints WHERE name = 'DF_FaceEmbeddings_EmbeddingDimensions')
BEGIN
    ALTER TABLE FaceEmbeddings
    ADD CONSTRAINT DF_FaceEmbeddings_EmbeddingDimensions 
        DEFAULT 512 FOR EmbeddingDimensions;
    PRINT 'Added default constraint for EmbeddingDimensions';
END
ELSE
BEGIN
    PRINT 'Default constraint for EmbeddingDimensions already exists';
END
GO

-- Step 5: Add index to quickly filter by model version (if it doesn't exist)
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_FaceEmbeddings_ModelVersion')
BEGIN
    CREATE NONCLUSTERED INDEX IX_FaceEmbeddings_ModelVersion
    ON FaceEmbeddings(ModelVersion, PersonID);
    PRINT 'Added index IX_FaceEmbeddings_ModelVersion';
END
ELSE
BEGIN
    PRINT 'Index IX_FaceEmbeddings_ModelVersion already exists';
END
GO

-- Step 6: Add table description
IF NOT EXISTS (
    SELECT * FROM sys.extended_properties 
    WHERE major_id = OBJECT_ID('FaceEmbeddings') 
    AND name = 'MS_Description' 
    AND minor_id = 0
)
BEGIN
    EXEC sys.sp_addextendedproperty 
        @name = N'MS_Description', 
        @value = N'Stores face embeddings from multiple models: face-api.js (128-dim FaceNet) and InsightFace (512-dim ArcFace). ModelVersion column distinguishes between models for comparison and migration.', 
        @level0type = N'SCHEMA', @level0name = N'dbo', 
        @level1type = N'TABLE', @level1name = N'FaceEmbeddings';
    PRINT 'Added table description';
END
ELSE
BEGIN
    PRINT 'Table description already exists';
END
GO

PRINT '';
PRINT '✅ Migration completed successfully!';
PRINT 'New embeddings will default to insightface-arcface (512-dim)';
GO

