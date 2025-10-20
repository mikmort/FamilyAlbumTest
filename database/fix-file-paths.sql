-- Fix duplicate paths and remove drive letters from Media table

-- First, let's see what we're dealing with
SELECT 
    'BEFORE FIX' as Status,
    COUNT(*) as Total,
    SUM(CASE WHEN PFileName LIKE 'B:%' OR PFileName LIKE 'C:%' OR PFileName LIKE 'D:%' THEN 1 ELSE 0 END) as WithDriveLetter,
    SUM(CASE WHEN PFileName LIKE '%Events/%Events/%' OR PFileName LIKE '%Birthdays/%Birthdays/%' THEN 1 ELSE 0 END) as WithDuplicatePath
FROM Media;

-- Fix PFileName: Remove drive letters
UPDATE Media
SET PFileName = SUBSTR(PFileName, INSTR(PFileName, ':') + 1)
WHERE PFileName LIKE 'B:%' OR PFileName LIKE 'C:%' OR PFileName LIKE 'D:%' OR PFileName LIKE '%:%';

-- Fix PFileName: Remove leading slashes after drive letter removal
UPDATE Media
SET PFileName = LTRIM(PFileName, '/')
WHERE PFileName LIKE '/%';

-- Fix PFileName: Remove leading backslashes
UPDATE Media
SET PFileName = REPLACE(PFileName, '\', '/')
WHERE PFileName LIKE '%\%';

-- Fix PFileName: Remove "Family Album/" prefix if present (since it's implied in blob storage)
UPDATE Media
SET PFileName = SUBSTR(PFileName, LENGTH('Family Album/') + 1)
WHERE PFileName LIKE 'Family Album/%';

-- Fix duplicate directory paths in PFileName
-- Example: "Events/Birthdays/Heather's 5th Birthday/Events/Birthdays/Heather's 5th Birthday/109_0943.JPG"
-- Should be: "Events/Birthdays/Heather's 5th Birthday/109_0943.JPG"

-- This is tricky - we need to find the pattern where the directory is duplicated
-- For now, let's identify specific cases and fix them manually

-- Check results
SELECT 
    'AFTER FIX' as Status,
    COUNT(*) as Total,
    SUM(CASE WHEN PFileName LIKE 'B:%' OR PFileName LIKE 'C:%' OR PFileName LIKE 'D:%' THEN 1 ELSE 0 END) as WithDriveLetter,
    SUM(CASE WHEN PFileName LIKE '%Events/%Events/%' OR PFileName LIKE '%Birthdays/%Birthdays/%' THEN 1 ELSE 0 END) as WithDuplicatePath
FROM Media;

-- Show some examples of fixed paths
SELECT PFileDirectory, PFileName
FROM Media
LIMIT 10;
