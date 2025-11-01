-- SQL script to update Pictures and NamePhoto tables after MPG to MP4 conversion
-- Updates 3 MPG video files

BEGIN TRANSACTION;

-- Disable foreign key constraint temporarily
ALTER TABLE dbo.NamePhoto NOCHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

-- Update Pictures table
UPDATE Pictures SET PFileName = 'Devorah''s Wedding 033.mp4' WHERE PFileName = 'Devorah''s Wedding 033.mpg';
UPDATE Pictures SET PFileName = 'Thanksgiving 058.mp4' WHERE PFileName = 'Thanksgiving 058.mpg';
UPDATE Pictures SET PFileName = 'Thanksgiving 059.mp4' WHERE PFileName = 'Thanksgiving 059.mpg';

-- Update NamePhoto table
UPDATE NamePhoto SET npFileName = 'Devorah''s Wedding 033.mp4' WHERE npFileName = 'Devorah''s Wedding 033.mpg';
UPDATE NamePhoto SET npFileName = 'Thanksgiving 058.mp4' WHERE npFileName = 'Thanksgiving 058.mpg';
UPDATE NamePhoto SET npFileName = 'Thanksgiving 059.mp4' WHERE npFileName = 'Thanksgiving 059.mpg';

-- Re-enable foreign key constraint
ALTER TABLE dbo.NamePhoto CHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

-- Verify the updates
SELECT 
    PFileName,
    PFileDirectory,
    PType
FROM Pictures 
WHERE PFileName IN ('Devorah''s Wedding 033.mp4', 'Thanksgiving 058.mp4', 'Thanksgiving 059.mp4');

-- Commit the changes
COMMIT;
