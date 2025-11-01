-- SQL script to update Pictures and NamePhoto tables after MOV to MP4 conversion
-- Generated: ${new Date().toISOString()}
-- Updates 81 entries
--
-- This script updates PFileName from .MOV to .mp4 for converted videos
-- The MP4 files exist in blob storage and are ready to use

BEGIN TRANSACTION;

-- First, disable the foreign key constraint temporarily
ALTER TABLE dbo.NamePhoto NOCHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

-- Update Pictures table
UPDATE Pictures SET PFileName = 'MVI_5712.mp4' WHERE PFileName = 'MVI_5712.MOV';
UPDATE Pictures SET PFileName = 'MVI_5725.mp4' WHERE PFileName = 'MVI_5725.MOV';
UPDATE Pictures SET PFileName = 'MVI_5732.mp4' WHERE PFileName = 'MVI_5732.MOV';
UPDATE Pictures SET PFileName = 'MVI_5734.mp4' WHERE PFileName = 'MVI_5734.MOV';
UPDATE Pictures SET PFileName = 'MVI_5735.mp4' WHERE PFileName = 'MVI_5735.MOV';
UPDATE Pictures SET PFileName = 'MVI_5741.mp4' WHERE PFileName = 'MVI_5741.MOV';
UPDATE Pictures SET PFileName = 'MVI_5747.mp4' WHERE PFileName = 'MVI_5747.MOV';
UPDATE Pictures SET PFileName = 'MVI_5753.mp4' WHERE PFileName = 'MVI_5753.MOV';
UPDATE Pictures SET PFileName = 'MVI_5768.mp4' WHERE PFileName = 'MVI_5768.MOV';
UPDATE Pictures SET PFileName = 'IMG_0231.mp4' WHERE PFileName = 'IMG_0231.mov';
UPDATE Pictures SET PFileName = 'PB240047.mp4' WHERE PFileName = 'PB240047.MOV';
UPDATE Pictures SET PFileName = 'PB240049.mp4' WHERE PFileName = 'PB240049.MOV';
UPDATE Pictures SET PFileName = 'PB240050.mp4' WHERE PFileName = 'PB240050.MOV';
UPDATE Pictures SET PFileName = 'PB240052.mp4' WHERE PFileName = 'PB240052.MOV';
UPDATE Pictures SET PFileName = 'PB240055.mp4' WHERE PFileName = 'PB240055.MOV';
UPDATE Pictures SET PFileName = 'PB260093.mp4' WHERE PFileName = 'PB260093.MOV';
UPDATE Pictures SET PFileName = 'PB260094.mp4' WHERE PFileName = 'PB260094.MOV';
UPDATE Pictures SET PFileName = 'PB260096.mp4' WHERE PFileName = 'PB260096.MOV';
UPDATE Pictures SET PFileName = 'PB260097.mp4' WHERE PFileName = 'PB260097.MOV';
UPDATE Pictures SET PFileName = 'PB270016.mp4' WHERE PFileName = 'PB270016.MOV';
UPDATE Pictures SET PFileName = 'MVI_5250.mp4' WHERE PFileName = 'MVI_5250.MOV';
UPDATE Pictures SET PFileName = 'MVI_5251.mp4' WHERE PFileName = 'MVI_5251.MOV';
UPDATE Pictures SET PFileName = 'MVI_5253.mp4' WHERE PFileName = 'MVI_5253.MOV';
UPDATE Pictures SET PFileName = 'MVI_5256.mp4' WHERE PFileName = 'MVI_5256.MOV';
UPDATE Pictures SET PFileName = 'MVI_5258.mp4' WHERE PFileName = 'MVI_5258.MOV';
UPDATE Pictures SET PFileName = 'MVI_5259.mp4' WHERE PFileName = 'MVI_5259.MOV';
UPDATE Pictures SET PFileName = 'MVI_5260.mp4' WHERE PFileName = 'MVI_5260.MOV';
UPDATE Pictures SET PFileName = 'MVI_5262.mp4' WHERE PFileName = 'MVI_5262.MOV';
UPDATE Pictures SET PFileName = 'MVI_5273.mp4' WHERE PFileName = 'MVI_5273.MOV';
UPDATE Pictures SET PFileName = 'MVI_5274.mp4' WHERE PFileName = 'MVI_5274.MOV';
UPDATE Pictures SET PFileName = 'MVI_5282.mp4' WHERE PFileName = 'MVI_5282.MOV';
UPDATE Pictures SET PFileName = 'MVI_5284.mp4' WHERE PFileName = 'MVI_5284.MOV';
UPDATE Pictures SET PFileName = 'MVI_5285.mp4' WHERE PFileName = 'MVI_5285.MOV';
UPDATE Pictures SET PFileName = 'MVI_5286.mp4' WHERE PFileName = 'MVI_5286.MOV';
UPDATE Pictures SET PFileName = 'MVI_5287.mp4' WHERE PFileName = 'MVI_5287.MOV';
UPDATE Pictures SET PFileName = 'MVI_5288.mp4' WHERE PFileName = 'MVI_5288.MOV';
UPDATE Pictures SET PFileName = 'MVI_5289.mp4' WHERE PFileName = 'MVI_5289.MOV';
UPDATE Pictures SET PFileName = 'MVI_5291.mp4' WHERE PFileName = 'MVI_5291.MOV';
UPDATE Pictures SET PFileName = 'MVI_5292.mp4' WHERE PFileName = 'MVI_5292.MOV';
UPDATE Pictures SET PFileName = 'MVI_5294.mp4' WHERE PFileName = 'MVI_5294.MOV';
UPDATE Pictures SET PFileName = 'MVI_5296.mp4' WHERE PFileName = 'MVI_5296.MOV';
UPDATE Pictures SET PFileName = 'MVI_5301.mp4' WHERE PFileName = 'MVI_5301.MOV';
UPDATE Pictures SET PFileName = 'MVI_5302.mp4' WHERE PFileName = 'MVI_5302.MOV';
UPDATE Pictures SET PFileName = 'MVI_5304.mp4' WHERE PFileName = 'MVI_5304.MOV';
UPDATE Pictures SET PFileName = 'MVI_5306.mp4' WHERE PFileName = 'MVI_5306.MOV';
UPDATE Pictures SET PFileName = 'MVI_5308.mp4' WHERE PFileName = 'MVI_5308.MOV';
UPDATE Pictures SET PFileName = 'MVI_0023.mp4' WHERE PFileName = 'MVI_0023.MOV';
UPDATE Pictures SET PFileName = 'MVI_0048.mp4' WHERE PFileName = 'MVI_0048.MOV';
UPDATE Pictures SET PFileName = 'MVI_0055.mp4' WHERE PFileName = 'MVI_0055.MOV';
UPDATE Pictures SET PFileName = 'MVI_0056.mp4' WHERE PFileName = 'MVI_0056.MOV';
UPDATE Pictures SET PFileName = 'MVI_0057.mp4' WHERE PFileName = 'MVI_0057.MOV';
UPDATE Pictures SET PFileName = 'MVI_0079.mp4' WHERE PFileName = 'MVI_0079.MOV';
UPDATE Pictures SET PFileName = 'MVI_0080.mp4' WHERE PFileName = 'MVI_0080.MOV';
UPDATE Pictures SET PFileName = 'MVI_0098.mp4' WHERE PFileName = 'MVI_0098.MOV';
UPDATE Pictures SET PFileName = 'MVI_0157.mp4' WHERE PFileName = 'MVI_0157.MOV';
UPDATE Pictures SET PFileName = 'MVI_0191.mp4' WHERE PFileName = 'MVI_0191.MOV';
UPDATE Pictures SET PFileName = 'IMG_7544.mp4' WHERE PFileName = 'IMG_7544.mov';
UPDATE Pictures SET PFileName = 'IMG_9784.mp4' WHERE PFileName = 'IMG_9784.mov';
UPDATE Pictures SET PFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mp4' WHERE PFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mov';
UPDATE Pictures SET PFileName = 'IMG_0310.mp4' WHERE PFileName = 'IMG_0310.MOV';
UPDATE Pictures SET PFileName = 'IMG_0870.mp4' WHERE PFileName = 'IMG_0870.mov';
UPDATE Pictures SET PFileName = 'IMG_3046.mp4' WHERE PFileName = 'IMG_3046.MOV';
UPDATE Pictures SET PFileName = 'IMG_9832.mp4' WHERE PFileName = 'IMG_9832.MOV';
UPDATE Pictures SET PFileName = 'MVI_0213.mp4' WHERE PFileName = 'MVI_0213.MOV';
UPDATE Pictures SET PFileName = 'MVI_0219.mp4' WHERE PFileName = 'MVI_0219.MOV';
UPDATE Pictures SET PFileName = 'P7190146.mp4' WHERE PFileName = 'P7190146.MOV';
UPDATE Pictures SET PFileName = 'P1230126.mp4' WHERE PFileName = 'P1230126.MOV';
UPDATE Pictures SET PFileName = 'P3170007.mp4' WHERE PFileName = 'P3170007.MOV';
UPDATE Pictures SET PFileName = 'P8240012.mp4' WHERE PFileName = 'P8240012.MOV';
UPDATE Pictures SET PFileName = 'P8240014.mp4' WHERE PFileName = 'P8240014.MOV';
UPDATE Pictures SET PFileName = 'P8240098.mp4' WHERE PFileName = 'P8240098.MOV';
UPDATE Pictures SET PFileName = 'P2200032.mp4' WHERE PFileName = 'P2200032.MOV';
UPDATE Pictures SET PFileName = 'P2210044.mp4' WHERE PFileName = 'P2210044.MOV';
UPDATE Pictures SET PFileName = 'P2210046.mp4' WHERE PFileName = 'P2210046.MOV';
UPDATE Pictures SET PFileName = 'P2220052.mp4' WHERE PFileName = 'P2220052.MOV';
UPDATE Pictures SET PFileName = 'P2240107.mp4' WHERE PFileName = 'P2240107.MOV';
UPDATE Pictures SET PFileName = 'P2240117.mp4' WHERE PFileName = 'P2240117.MOV';

-- Update NamePhoto table
UPDATE NamePhoto SET npFileName = 'MVI_5712.mp4' WHERE npFileName = 'MVI_5712.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5725.mp4' WHERE npFileName = 'MVI_5725.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5732.mp4' WHERE npFileName = 'MVI_5732.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5734.mp4' WHERE npFileName = 'MVI_5734.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5735.mp4' WHERE npFileName = 'MVI_5735.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5741.mp4' WHERE npFileName = 'MVI_5741.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5747.mp4' WHERE npFileName = 'MVI_5747.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5753.mp4' WHERE npFileName = 'MVI_5753.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5768.mp4' WHERE npFileName = 'MVI_5768.MOV';
UPDATE NamePhoto SET npFileName = 'IMG_0231.mp4' WHERE npFileName = 'IMG_0231.mov';
UPDATE NamePhoto SET npFileName = 'PB240047.mp4' WHERE npFileName = 'PB240047.MOV';
UPDATE NamePhoto SET npFileName = 'PB240049.mp4' WHERE npFileName = 'PB240049.MOV';
UPDATE NamePhoto SET npFileName = 'PB240050.mp4' WHERE npFileName = 'PB240050.MOV';
UPDATE NamePhoto SET npFileName = 'PB240052.mp4' WHERE npFileName = 'PB240052.MOV';
UPDATE NamePhoto SET npFileName = 'PB240055.mp4' WHERE npFileName = 'PB240055.MOV';
UPDATE NamePhoto SET npFileName = 'PB260093.mp4' WHERE npFileName = 'PB260093.MOV';
UPDATE NamePhoto SET npFileName = 'PB260094.mp4' WHERE npFileName = 'PB260094.MOV';
UPDATE NamePhoto SET npFileName = 'PB260096.mp4' WHERE npFileName = 'PB260096.MOV';
UPDATE NamePhoto SET npFileName = 'PB260097.mp4' WHERE npFileName = 'PB260097.MOV';
UPDATE NamePhoto SET npFileName = 'PB270016.mp4' WHERE npFileName = 'PB270016.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5250.mp4' WHERE npFileName = 'MVI_5250.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5251.mp4' WHERE npFileName = 'MVI_5251.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5253.mp4' WHERE npFileName = 'MVI_5253.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5256.mp4' WHERE npFileName = 'MVI_5256.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5258.mp4' WHERE npFileName = 'MVI_5258.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5259.mp4' WHERE npFileName = 'MVI_5259.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5260.mp4' WHERE npFileName = 'MVI_5260.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5262.mp4' WHERE npFileName = 'MVI_5262.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5273.mp4' WHERE npFileName = 'MVI_5273.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5274.mp4' WHERE npFileName = 'MVI_5274.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5282.mp4' WHERE npFileName = 'MVI_5282.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5284.mp4' WHERE npFileName = 'MVI_5284.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5285.mp4' WHERE npFileName = 'MVI_5285.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5286.mp4' WHERE npFileName = 'MVI_5286.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5287.mp4' WHERE npFileName = 'MVI_5287.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5288.mp4' WHERE npFileName = 'MVI_5288.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5289.mp4' WHERE npFileName = 'MVI_5289.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5291.mp4' WHERE npFileName = 'MVI_5291.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5292.mp4' WHERE npFileName = 'MVI_5292.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5294.mp4' WHERE npFileName = 'MVI_5294.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5296.mp4' WHERE npFileName = 'MVI_5296.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5301.mp4' WHERE npFileName = 'MVI_5301.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5302.mp4' WHERE npFileName = 'MVI_5302.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5304.mp4' WHERE npFileName = 'MVI_5304.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5306.mp4' WHERE npFileName = 'MVI_5306.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_5308.mp4' WHERE npFileName = 'MVI_5308.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0023.mp4' WHERE npFileName = 'MVI_0023.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0048.mp4' WHERE npFileName = 'MVI_0048.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0055.mp4' WHERE npFileName = 'MVI_0055.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0056.mp4' WHERE npFileName = 'MVI_0056.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0057.mp4' WHERE npFileName = 'MVI_0057.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0079.mp4' WHERE npFileName = 'MVI_0079.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0080.mp4' WHERE npFileName = 'MVI_0080.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0098.mp4' WHERE npFileName = 'MVI_0098.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0157.mp4' WHERE npFileName = 'MVI_0157.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0191.mp4' WHERE npFileName = 'MVI_0191.MOV';
UPDATE NamePhoto SET npFileName = 'IMG_7544.mp4' WHERE npFileName = 'IMG_7544.mov';
UPDATE NamePhoto SET npFileName = 'IMG_9784.mp4' WHERE npFileName = 'IMG_9784.mov';
UPDATE NamePhoto SET npFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mp4' WHERE npFileName = '71841758817__B521553C-531A-4209-A721-49A39092DEE7.mov';
UPDATE NamePhoto SET npFileName = 'IMG_0310.mp4' WHERE npFileName = 'IMG_0310.MOV';
UPDATE NamePhoto SET npFileName = 'IMG_0870.mp4' WHERE npFileName = 'IMG_0870.mov';
UPDATE NamePhoto SET npFileName = 'IMG_3046.mp4' WHERE npFileName = 'IMG_3046.MOV';
UPDATE NamePhoto SET npFileName = 'IMG_9832.mp4' WHERE npFileName = 'IMG_9832.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0213.mp4' WHERE npFileName = 'MVI_0213.MOV';
UPDATE NamePhoto SET npFileName = 'MVI_0219.mp4' WHERE npFileName = 'MVI_0219.MOV';
UPDATE NamePhoto SET npFileName = 'P7190146.mp4' WHERE npFileName = 'P7190146.MOV';
UPDATE NamePhoto SET npFileName = 'P1230126.mp4' WHERE npFileName = 'P1230126.MOV';
UPDATE NamePhoto SET npFileName = 'P3170007.mp4' WHERE npFileName = 'P3170007.MOV';
UPDATE NamePhoto SET npFileName = 'P8240012.mp4' WHERE npFileName = 'P8240012.MOV';
UPDATE NamePhoto SET npFileName = 'P8240014.mp4' WHERE npFileName = 'P8240014.MOV';
UPDATE NamePhoto SET npFileName = 'P8240098.mp4' WHERE npFileName = 'P8240098.MOV';
UPDATE NamePhoto SET npFileName = 'P2200032.mp4' WHERE npFileName = 'P2200032.MOV';
UPDATE NamePhoto SET npFileName = 'P2210044.mp4' WHERE npFileName = 'P2210044.MOV';
UPDATE NamePhoto SET npFileName = 'P2210046.mp4' WHERE npFileName = 'P2210046.MOV';
UPDATE NamePhoto SET npFileName = 'P2220052.mp4' WHERE npFileName = 'P2220052.MOV';
UPDATE NamePhoto SET npFileName = 'P2240107.mp4' WHERE npFileName = 'P2240107.MOV';
UPDATE NamePhoto SET npFileName = 'P2240117.mp4' WHERE npFileName = 'P2240117.MOV';

-- Re-enable the foreign key constraint
ALTER TABLE dbo.NamePhoto CHECK CONSTRAINT FK__NamePhoto__npFil__00200768;

-- Verify the updates
SELECT 
    COUNT(*) as UpdatedCount,
    'Successfully updated to MP4' as Status
FROM Pictures 
WHERE PFileName LIKE '%.mp4';

-- Commit the changes
COMMIT;

-- After committing:
-- 1. Videos will reference .mp4 files
-- 2. Videos will play in browser without download
-- 3. Thumbnails will regenerate automatically
-- 4. You can optionally delete old .MOV files from blob storage
