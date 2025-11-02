-- Check how many images have person ID 199
SELECT COUNT(DISTINCT np.npFileName) as TotalImagesWithPerson199
FROM dbo.NamePhoto np
INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
WHERE np.npID = 199
AND ne.neType = 'N'
