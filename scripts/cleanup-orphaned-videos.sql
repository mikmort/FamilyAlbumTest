-- Clean up orphaned video entries without directory paths
-- These entries were created during MOV to MP4 conversion and lack proper paths

BEGIN TRANSACTION;

-- First, let's see what we're about to delete
PRINT 'Videos without directory paths that will be deleted:';
SELECT PFileName, PDescription 
FROM Pictures 
WHERE PFileName NOT LIKE '%/%' 
  AND (PFileName LIKE '%.mp4' OR PFileName LIKE '%.MOV' OR PFileName LIKE '%.avi' OR PFileName LIKE '%.mpg');

-- Disable foreign key constraint temporarily
ALTER TABLE NamePhoto NOCHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

-- Delete the orphaned entries
DELETE FROM Pictures 
WHERE PFileName NOT LIKE '%/%' 
  AND (PFileName LIKE '%.mp4' OR PFileName LIKE '%.MOV' OR PFileName LIKE '%.avi' OR PFileName LIKE '%.mpg');

PRINT 'Deleted ' + CAST(@@ROWCOUNT AS VARCHAR) + ' orphaned video entries';

-- Re-enable foreign key constraint
ALTER TABLE NamePhoto CHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

COMMIT TRANSACTION;

PRINT 'Cleanup complete!';
