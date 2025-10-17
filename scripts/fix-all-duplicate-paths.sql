-- Fix all Pictures entries where PFileName incorrectly contains directory paths
-- This happens when PFileName contains backslashes AND PFileDirectory is also set

-- First, identify problematic entries
SELECT 
    PFileName,
    PFileDirectory,
    'Problem: PFileName contains directory path' AS Issue
FROM dbo.Pictures
WHERE PFileName LIKE '%\%'
  AND PFileDirectory IS NOT NULL
  AND PFileDirectory != ''
  AND PFileName LIKE PFileDirectory + '%';

-- Fix strategy: When PFileName already contains the full path including directory,
-- extract just the filename portion and keep the directory in PFileDirectory

-- However, we need to be careful because some entries legitimately have
-- subdirectories in the filename (like "Devorah's Wedding\PA130111.JPG")
-- where "Devorah's Wedding" IS the directory

-- Solution: Only fix entries where PFileName starts with PFileDirectory
-- and contains additional path separator

UPDATE dbo.Pictures
SET PFileName = SUBSTRING(
    PFileName,
    LEN(PFileDirectory) + 2,  -- +2 to skip the directory name and backslash
    LEN(PFileName)
)
WHERE PFileName LIKE PFileDirectory + '\%'
  AND PFileName LIKE '%\%\%';  -- Contains at least 2 backslashes (directory + subdirectory + filename)

-- For the specific Devorah case - move it to correct directory
UPDATE dbo.Pictures  
SET 
    PFileDirectory = 'Devorah''s Wedding',
    PFileName = 'DevorahWedding.jpg'
WHERE PFileName = 'Family Pictures\DevorahWedding.jpg';

-- Verify what's left
SELECT 
    PFileName,
    PFileDirectory,
    CASE 
        WHEN PFileDirectory IS NOT NULL AND PFileDirectory != '' 
        THEN PFileDirectory + '\' + PFileName
        ELSE PFileName
    END AS CombinedPath
FROM dbo.Pictures
WHERE PFileName LIKE '%Devorah%' OR PFileDirectory LIKE '%Devorah%'
ORDER BY PFileName;
