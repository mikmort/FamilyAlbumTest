-- Fix MOV files with invalid PType value
-- These files have PType = 3 which is invalid (should be 1=image or 2=video)
-- Update all video files (MOV, MP4, AVI) with PType = 3 to PType = 2

BEGIN TRANSACTION;

-- Show current state
PRINT 'Current MOV files with PType = 3:';
SELECT PFileName, PType, PTime 
FROM Pictures 
WHERE PType = 3 
AND (LOWER(PFileName) LIKE '%.mov' OR LOWER(PFileName) LIKE '%.mp4' OR LOWER(PFileName) LIKE '%.avi')
ORDER BY PFileName;

-- Update MOV files
UPDATE Pictures 
SET PType = 2
WHERE PType = 3 
AND (LOWER(PFileName) LIKE '%.mov' 
     OR LOWER(PFileName) LIKE '%.mp4' 
     OR LOWER(PFileName) LIKE '%.avi');

PRINT '';
PRINT 'Updated ' + CAST(@@ROWCOUNT AS VARCHAR) + ' video files from PType = 3 to PType = 2';
PRINT '';

-- Verify the fix
PRINT 'After update - MOV files should now have PType = 2:';
SELECT PFileName, PType, PTime 
FROM Pictures 
WHERE (LOWER(PFileName) LIKE '%.mov' 
       OR LOWER(PFileName) LIKE '%.mp4' 
       OR LOWER(PFileName) LIKE '%.avi')
AND PType = 2
ORDER BY PFileName;

-- Check if any video files still have wrong PType
PRINT '';
PRINT 'Any remaining video files with PType != 2:';
SELECT PFileName, PType, PTime 
FROM Pictures 
WHERE (LOWER(PFileName) LIKE '%.mov' 
       OR LOWER(PFileName) LIKE '%.mp4' 
       OR LOWER(PFileName) LIKE '%.avi')
AND PType != 2;

-- If everything looks good, commit
COMMIT TRANSACTION;
PRINT '';
PRINT 'Transaction committed successfully!';
