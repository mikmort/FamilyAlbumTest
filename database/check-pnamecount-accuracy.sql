-- Query to check PNameCount accuracy
-- Compare actual count of people in NamePhoto vs stored PNameCount

SELECT TOP 50
    p.PFileName,
    p.PNameCount as StoredCount,
    COUNT(DISTINCT np.npID) as ActualCount
FROM dbo.Pictures p
LEFT JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
GROUP BY p.PFileName, p.PNameCount
HAVING COUNT(DISTINCT np.npID) > 0
ORDER BY ABS(p.PNameCount - COUNT(DISTINCT np.npID)) DESC

-- If this shows mismatches, it means PNameCount is not accurate!
