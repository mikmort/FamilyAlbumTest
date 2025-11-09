-- Add support for InsightFace 512-dim embeddings alongside face-api.js 128-dim
-- This allows gradual migration and A/B testing between models

-- Add columns to track embedding model version and dimensions
ALTER TABLE FaceEmbeddings
ADD 
    ModelVersion VARCHAR(50) NULL,  -- 'face-api-js' or 'insightface-arcface'
    EmbeddingDimensions INT NULL;    -- 128 or 512

-- Update existing rows to mark them as face-api.js embeddings
UPDATE FaceEmbeddings
SET 
    ModelVersion = 'face-api-js',
    EmbeddingDimensions = 128
WHERE ModelVersion IS NULL;

-- Make the columns NOT NULL after populating existing data
ALTER TABLE FaceEmbeddings
ALTER COLUMN ModelVersion VARCHAR(50) NOT NULL;

ALTER TABLE FaceEmbeddings
ALTER COLUMN EmbeddingDimensions INT NOT NULL;

-- Add default constraints for new rows
ALTER TABLE FaceEmbeddings
ADD CONSTRAINT DF_FaceEmbeddings_ModelVersion 
    DEFAULT 'insightface-arcface' FOR ModelVersion;

ALTER TABLE FaceEmbeddings
ADD CONSTRAINT DF_FaceEmbeddings_EmbeddingDimensions 
    DEFAULT 512 FOR EmbeddingDimensions;

-- Add index to quickly filter by model version
CREATE NONCLUSTERED INDEX IX_FaceEmbeddings_ModelVersion
ON FaceEmbeddings(ModelVersion, PersonID);

-- Add a comment to the table for documentation
EXEC sys.sp_addextendedproperty 
    @name = N'MS_Description', 
    @value = N'Stores face embeddings from multiple models: face-api.js (128-dim FaceNet) and InsightFace (512-dim ArcFace). ModelVersion column distinguishes between models for comparison and migration.', 
    @level0type = N'SCHEMA', @level0name = N'dbo', 
    @level1type = N'TABLE', @level1name = N'FaceEmbeddings';

PRINT 'Successfully added ModelVersion and EmbeddingDimensions columns to FaceEmbeddings table';
PRINT 'Existing embeddings marked as face-api-js (128-dim)';
PRINT 'New embeddings will default to insightface-arcface (512-dim)';
