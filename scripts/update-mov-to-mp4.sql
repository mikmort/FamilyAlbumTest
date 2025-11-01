-- SQL script to update Pictures table after MOV to MP4 conversion
-- Generated: 2025-11-01T21:52:02.169Z
-- Updates 81 entries
--
-- This script updates PFileName from .MOV to .mp4 for converted videos
-- The MP4 files exist in blob storage and are ready to use

BEGIN TRANSACTION;

-- MVI_5712.MOV -> MVI_5712.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5712.mp4'
WHERE PFileName = 'MVI_5712.MOV';

-- MVI_5725.MOV -> MVI_5725.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5725.mp4'
WHERE PFileName = 'MVI_5725.MOV';

-- MVI_5732.MOV -> MVI_5732.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5732.mp4'
WHERE PFileName = 'MVI_5732.MOV';

-- MVI_5734.MOV -> MVI_5734.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5734.mp4'
WHERE PFileName = 'MVI_5734.MOV';

-- MVI_5735.MOV -> MVI_5735.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5735.mp4'
WHERE PFileName = 'MVI_5735.MOV';

-- MVI_5741.MOV -> MVI_5741.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5741.mp4'
WHERE PFileName = 'MVI_5741.MOV';

-- MVI_5747.MOV -> MVI_5747.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5747.mp4'
WHERE PFileName = 'MVI_5747.MOV';

-- MVI_5753.MOV -> MVI_5753.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5753.mp4'
WHERE PFileName = 'MVI_5753.MOV';

-- MVI_5768.MOV -> MVI_5768.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5768.mp4'
WHERE PFileName = 'MVI_5768.MOV';

-- IMG_0231.mov -> IMG_0231.mp4
UPDATE Pictures 
SET PFileName = 'IMG_0231.mp4'
WHERE PFileName = 'IMG_0231.mov';

-- PB240047.MOV -> PB240047.mp4
UPDATE Pictures 
SET PFileName = 'PB240047.mp4'
WHERE PFileName = 'PB240047.MOV';

-- PB240049.MOV -> PB240049.mp4
UPDATE Pictures 
SET PFileName = 'PB240049.mp4'
WHERE PFileName = 'PB240049.MOV';

-- PB240050.MOV -> PB240050.mp4
UPDATE Pictures 
SET PFileName = 'PB240050.mp4'
WHERE PFileName = 'PB240050.MOV';

-- PB240052.MOV -> PB240052.mp4
UPDATE Pictures 
SET PFileName = 'PB240052.mp4'
WHERE PFileName = 'PB240052.MOV';

-- PB240055.MOV -> PB240055.mp4
UPDATE Pictures 
SET PFileName = 'PB240055.mp4'
WHERE PFileName = 'PB240055.MOV';

-- PB260093.MOV -> PB260093.mp4
UPDATE Pictures 
SET PFileName = 'PB260093.mp4'
WHERE PFileName = 'PB260093.MOV';

-- PB260094.MOV -> PB260094.mp4
UPDATE Pictures 
SET PFileName = 'PB260094.mp4'
WHERE PFileName = 'PB260094.MOV';

-- PB260096.MOV -> PB260096.mp4
UPDATE Pictures 
SET PFileName = 'PB260096.mp4'
WHERE PFileName = 'PB260096.MOV';

-- PB260097.MOV -> PB260097.mp4
UPDATE Pictures 
SET PFileName = 'PB260097.mp4'
WHERE PFileName = 'PB260097.MOV';

-- PB270016.MOV -> PB270016.mp4
UPDATE Pictures 
SET PFileName = 'PB270016.mp4'
WHERE PFileName = 'PB270016.MOV';

-- MVI_5250.MOV -> MVI_5250.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5250.mp4'
WHERE PFileName = 'MVI_5250.MOV';

-- MVI_5251.MOV -> MVI_5251.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5251.mp4'
WHERE PFileName = 'MVI_5251.MOV';

-- MVI_5253.MOV -> MVI_5253.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5253.mp4'
WHERE PFileName = 'MVI_5253.MOV';

-- MVI_5256.MOV -> MVI_5256.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5256.mp4'
WHERE PFileName = 'MVI_5256.MOV';

-- MVI_5258.MOV -> MVI_5258.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5258.mp4'
WHERE PFileName = 'MVI_5258.MOV';

-- MVI_5259.MOV -> MVI_5259.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5259.mp4'
WHERE PFileName = 'MVI_5259.MOV';

-- MVI_5260.MOV -> MVI_5260.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5260.mp4'
WHERE PFileName = 'MVI_5260.MOV';

-- MVI_5262.MOV -> MVI_5262.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5262.mp4'
WHERE PFileName = 'MVI_5262.MOV';

-- MVI_5273.MOV -> MVI_5273.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5273.mp4'
WHERE PFileName = 'MVI_5273.MOV';

-- MVI_5274.MOV -> MVI_5274.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5274.mp4'
WHERE PFileName = 'MVI_5274.MOV';

-- MVI_5282.MOV -> MVI_5282.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5282.mp4'
WHERE PFileName = 'MVI_5282.MOV';

-- MVI_5284.MOV -> MVI_5284.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5284.mp4'
WHERE PFileName = 'MVI_5284.MOV';

-- MVI_5285.MOV -> MVI_5285.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5285.mp4'
WHERE PFileName = 'MVI_5285.MOV';

-- MVI_5286.MOV -> MVI_5286.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5286.mp4'
WHERE PFileName = 'MVI_5286.MOV';

-- MVI_5287.MOV -> MVI_5287.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5287.mp4'
WHERE PFileName = 'MVI_5287.MOV';

-- MVI_5288.MOV -> MVI_5288.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5288.mp4'
WHERE PFileName = 'MVI_5288.MOV';

-- MVI_5289.MOV -> MVI_5289.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5289.mp4'
WHERE PFileName = 'MVI_5289.MOV';

-- MVI_5291.MOV -> MVI_5291.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5291.mp4'
WHERE PFileName = 'MVI_5291.MOV';

-- MVI_5292.MOV -> MVI_5292.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5292.mp4'
WHERE PFileName = 'MVI_5292.MOV';

-- MVI_5294.MOV -> MVI_5294.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5294.mp4'
WHERE PFileName = 'MVI_5294.MOV';

-- MVI_5296.MOV -> MVI_5296.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5296.mp4'
WHERE PFileName = 'MVI_5296.MOV';

-- MVI_5301.MOV -> MVI_5301.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5301.mp4'
WHERE PFileName = 'MVI_5301.MOV';

-- MVI_5302.MOV -> MVI_5302.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5302.mp4'
WHERE PFileName = 'MVI_5302.MOV';

-- MVI_5304.MOV -> MVI_5304.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5304.mp4'
WHERE PFileName = 'MVI_5304.MOV';

-- MVI_5306.MOV -> MVI_5306.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5306.mp4'
WHERE PFileName = 'MVI_5306.MOV';

-- MVI_5308.MOV -> MVI_5308.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5308.mp4'
WHERE PFileName = 'MVI_5308.MOV';

-- MVI_0023.MOV -> MVI_0023.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0023.mp4'
WHERE PFileName = 'MVI_0023.MOV';

-- MVI_0048.MOV -> MVI_0048.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0048.mp4'
WHERE PFileName = 'MVI_0048.MOV';

-- MVI_0055.MOV -> MVI_0055.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0055.mp4'
WHERE PFileName = 'MVI_0055.MOV';

-- MVI_0056.MOV -> MVI_0056.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0056.mp4'
WHERE PFileName = 'MVI_0056.MOV';

-- MVI_0057.MOV -> MVI_0057.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0057.mp4'
WHERE PFileName = 'MVI_0057.MOV';

-- MVI_0079.MOV -> MVI_0079.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0079.mp4'
WHERE PFileName = 'MVI_0079.MOV';

-- MVI_0080.MOV -> MVI_0080.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0080.mp4'
WHERE PFileName = 'MVI_0080.MOV';

-- MVI_0098.MOV -> MVI_0098.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0098.mp4'
WHERE PFileName = 'MVI_0098.MOV';

-- MVI_0157.MOV -> MVI_0157.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0157.mp4'
WHERE PFileName = 'MVI_0157.MOV';

-- MVI_0191.MOV -> MVI_0191.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0191.mp4'
WHERE PFileName = 'MVI_0191.MOV';

-- IMG_7544.mov -> IMG_7544.mp4
UPDATE Pictures 
SET PFileName = 'IMG_7544.mp4'
WHERE PFileName = 'IMG_7544.mov';

-- IMG_9784.mov -> IMG_9784.mp4
UPDATE Pictures 
SET PFileName = 'IMG_9784.mp4'
WHERE PFileName = 'IMG_9784.mov';

-- 71841758817__B521553C-531A-4209-A721-49A39092DEE7.mov -> 71841758817__B521553C-531A-4209-A721-49A39092DEE7.mp4
UPDATE Pictures 
SET PFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mp4'
WHERE PFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mov';

-- IMG_0310.MOV -> IMG_0310.mp4
UPDATE Pictures 
SET PFileName = 'IMG_0310.mp4'
WHERE PFileName = 'IMG_0310.MOV';

-- IMG_0870.mov -> IMG_0870.mp4
UPDATE Pictures 
SET PFileName = 'IMG_0870.mp4'
WHERE PFileName = 'IMG_0870.mov';

-- IMG_3046.MOV -> IMG_3046.mp4
UPDATE Pictures 
SET PFileName = 'IMG_3046.mp4'
WHERE PFileName = 'IMG_3046.MOV';

-- IMG_9832.MOV -> IMG_9832.mp4
UPDATE Pictures 
SET PFileName = 'IMG_9832.mp4'
WHERE PFileName = 'IMG_9832.MOV';

-- MVI_0213.MOV -> MVI_0213.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0213.mp4'
WHERE PFileName = 'MVI_0213.MOV';

-- MVI_0213.MOV -> MVI_0213.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0213.mp4'
WHERE PFileName = 'MVI_0213.MOV';

-- MVI_0219.MOV -> MVI_0219.mp4
UPDATE Pictures 
SET PFileName = 'MVI_0219.mp4'
WHERE PFileName = 'MVI_0219.MOV';

-- P7190146.MOV -> P7190146.mp4
UPDATE Pictures 
SET PFileName = 'P7190146.mp4'
WHERE PFileName = 'P7190146.MOV';

-- P1230126.MOV -> P1230126.mp4
UPDATE Pictures 
SET PFileName = 'P1230126.mp4'
WHERE PFileName = 'P1230126.MOV';

-- P3170007.MOV -> P3170007.mp4
UPDATE Pictures 
SET PFileName = 'P3170007.mp4'
WHERE PFileName = 'P3170007.MOV';

-- P8240012.MOV -> P8240012.mp4
UPDATE Pictures 
SET PFileName = 'P8240012.mp4'
WHERE PFileName = 'P8240012.MOV';

-- P8240014.MOV -> P8240014.mp4
UPDATE Pictures 
SET PFileName = 'P8240014.mp4'
WHERE PFileName = 'P8240014.MOV';

-- P8240098.MOV -> P8240098.mp4
UPDATE Pictures 
SET PFileName = 'P8240098.mp4'
WHERE PFileName = 'P8240098.MOV';

-- P2200032.MOV -> P2200032.mp4
UPDATE Pictures 
SET PFileName = 'P2200032.mp4'
WHERE PFileName = 'P2200032.MOV';

-- P2210044.MOV -> P2210044.mp4
UPDATE Pictures 
SET PFileName = 'P2210044.mp4'
WHERE PFileName = 'P2210044.MOV';

-- P2210046.MOV -> P2210046.mp4
UPDATE Pictures 
SET PFileName = 'P2210046.mp4'
WHERE PFileName = 'P2210046.MOV';

-- P2220052.MOV -> P2220052.mp4
UPDATE Pictures 
SET PFileName = 'P2220052.mp4'
WHERE PFileName = 'P2220052.MOV';

-- P2240107.MOV -> P2240107.mp4
UPDATE Pictures 
SET PFileName = 'P2240107.mp4'
WHERE PFileName = 'P2240107.MOV';

-- P2240117.MOV -> P2240117.mp4
UPDATE Pictures 
SET PFileName = 'P2240117.mp4'
WHERE PFileName = 'P2240117.MOV';

-- MVI_5258.MOV -> MVI_5258.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5258.mp4'
WHERE PFileName = 'MVI_5258.MOV';

-- MVI_5292.MOV -> MVI_5292.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5292.mp4'
WHERE PFileName = 'MVI_5292.MOV';

-- MVI_5732.MOV -> MVI_5732.mp4
UPDATE Pictures 
SET PFileName = 'MVI_5732.mp4'
WHERE PFileName = 'MVI_5732.MOV';

-- Verify the updates
SELECT 
    COUNT(*) as UpdatedCount,
    'Successfully updated to MP4' as Status
FROM Pictures 
WHERE PFileName LIKE '%.mp4';

-- Review the updates above, then uncomment COMMIT to apply changes:
COMMIT;

-- Or run ROLLBACK to undo:
-- ROLLBACK;

-- After committing:
-- 1. Videos will reference .mp4 files
-- 2. Videos will play in browser without download
-- 3. Thumbnails will regenerate automatically
-- 4. You can optionally delete old .MOV files from blob storage
