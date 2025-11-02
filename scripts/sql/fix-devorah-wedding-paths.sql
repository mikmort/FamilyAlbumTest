-- Fix paths for Devorah's Wedding photos
-- This script updates the database to match the actual blob storage paths

-- First, let's see what we have (for verification)
SELECT 
    PFileName,
    PFileDirectory,
    CASE 
        WHEN PFileDirectory IS NOT NULL AND PFileDirectory != '' 
        THEN PFileDirectory + '\' + PFileName
        ELSE PFileName
    END AS FullPath
FROM dbo.Pictures
WHERE PFileName LIKE '%Devorah%' OR PFileDirectory LIKE '%Devorah%'
ORDER BY PFileName;

-- Fix the specific problematic entry:
-- PFileName = 'Family Pictures\DevorahWedding.jpg'
-- PFileDirectory = 'Family Pictures'
-- This should be moved to Devorah's Wedding directory

-- The issue is that PFileName contains the directory already, and it's the wrong directory
-- We need to:
-- 1. Extract just the filename (DevorahWedding.jpg)
-- 2. Move it to the correct directory (Devorah's Wedding)

UPDATE dbo.Pictures
SET 
    PFileDirectory = 'Devorah''s Wedding',
    PFileName = 'DevorahWedding.jpg'
WHERE PFileName = 'Family Pictures\DevorahWedding.jpg'
  AND PFileDirectory = 'Family Pictures';

-- Verify the changes
SELECT 
    PFileName,
    PFileDirectory,
    CASE 
        WHEN PFileDirectory IS NOT NULL AND PFileDirectory != '' 
        THEN PFileDirectory + '\' + PFileName
        ELSE PFileName
    END AS FullPath,
    PBlobUrl
FROM dbo.Pictures
WHERE PFileName LIKE '%Devorah%' OR PFileDirectory LIKE '%Devorah%'
ORDER BY PFileName;
