-- Script to verify and fix PNameCount accuracy
-- This recalculates PNameCount from actual NamePhoto records

BEGIN TRANSACTION;

-- Create a temp table with corrected counts
WITH CorrectCounts AS (
    SELECT 
        p.PFileName,
        p.PNameCount as OldCount,
        COUNT(DISTINCT np.npID) as CorrectCount
    FROM dbo.Pictures p
    LEFT JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
    GROUP BY p.PFileName, p.PNameCount
)
UPDATE dbo.Pictures
SET PNameCount = (
    SELECT CorrectCount
    FROM CorrectCounts cc
    WHERE cc.PFileName = dbo.Pictures.PFileName
),
PLastModifiedDate = GETDATE()
WHERE PFileName IN (
    SELECT PFileName FROM CorrectCounts WHERE OldCount != CorrectCount
);

-- Report on changes made
SELECT 
    COUNT(*) as RecordsUpdated,
    MIN(OldCount) as MinOldCount,
    MAX(OldCount) as MaxOldCount,
    MIN(CorrectCount) as MinCorrectCount,
    MAX(CorrectCount) as MaxCorrectCount
FROM (
    SELECT 
        p.PNameCount as OldCount,
        COUNT(DISTINCT np.npID) as CorrectCount
    FROM dbo.Pictures p
    LEFT JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
    GROUP BY p.PFileName, p.PNameCount
    HAVING p.PNameCount != COUNT(DISTINCT np.npID)
) AS Changes;

-- COMMIT or ROLLBACK
-- COMMIT;
-- ROLLBACK;
