/*
 * Clear Incorrect Event Dates
 * 
 * This script identifies events whose EventDate doesn't match their associated photos
 * and clears those dates.
 * 
 * Run this in Azure Data Studio or SQL Server Management Studio
 */

-- First, let's see all events with dates and their photo years
SELECT 
    ne.ID,
    ne.neName AS EventName,
    ne.EventDate,
    YEAR(ne.EventDate) AS EventYear,
    MONTH(ne.EventDate) AS EventMonth,
    ne.neCount AS PhotoCount,
    MIN(p.PYear) AS MinPhotoYear,
    MAX(p.PYear) AS MaxPhotoYear,
    COUNT(DISTINCT p.PYear) AS UniqueYears,
    STRING_AGG(CAST(p.PYear AS VARCHAR), ', ') WITHIN GROUP (ORDER BY p.PYear) AS PhotoYears
FROM dbo.NameEvent ne
LEFT JOIN dbo.NamePhoto np ON ne.ID = np.npID
LEFT JOIN dbo.Pictures p ON np.npFileName = p.PFileName
WHERE ne.neType = 'E' 
    AND ne.EventDate IS NOT NULL
    AND p.PYear IS NOT NULL
    AND p.PYear BETWEEN 1900 AND 2100
GROUP BY ne.ID, ne.neName, ne.EventDate, ne.neCount
ORDER BY ne.neName;

-- Identify events where the date appears incorrect:
-- 1. Event year doesn't match any photo year
-- 2. Photos span multiple years but event name doesn't contain the year
PRINT '----------------------------------------';
PRINT 'Events with potentially incorrect dates:';
PRINT '----------------------------------------';

WITH EventPhotoYears AS (
    SELECT 
        ne.ID,
        ne.neName,
        ne.EventDate,
        YEAR(ne.EventDate) AS EventYear,
        MIN(p.PYear) AS MinPhotoYear,
        MAX(p.PYear) AS MaxPhotoYear,
        COUNT(DISTINCT p.PYear) AS UniqueYearCount
    FROM dbo.NameEvent ne
    LEFT JOIN dbo.NamePhoto np ON ne.ID = np.npID
    LEFT JOIN dbo.Pictures p ON np.npFileName = p.PFileName
    WHERE ne.neType = 'E' 
        AND ne.EventDate IS NOT NULL
        AND p.PYear IS NOT NULL
        AND p.PYear BETWEEN 1900 AND 2100
    GROUP BY ne.ID, ne.neName, ne.EventDate
)
SELECT 
    ID,
    neName AS EventName,
    EventDate,
    EventYear,
    MinPhotoYear,
    MaxPhotoYear,
    UniqueYearCount,
    CASE 
        WHEN EventYear < MinPhotoYear OR EventYear > MaxPhotoYear 
            THEN 'Event year not in photo range'
        WHEN UniqueYearCount > 1 AND neName NOT LIKE '%' + CAST(EventYear AS VARCHAR) + '%'
            THEN 'Photos span multiple years'
        ELSE 'Potentially OK'
    END AS Issue
FROM EventPhotoYears
WHERE EventYear < MinPhotoYear 
    OR EventYear > MaxPhotoYear
    OR (UniqueYearCount > 1 AND neName NOT LIKE '%' + CAST(EventYear AS VARCHAR) + '%')
ORDER BY neName;

-- TO CLEAR THE DATES (uncomment and run separately):
/*
UPDATE ne
SET EventDate = NULL
FROM dbo.NameEvent ne
WHERE ne.ID IN (
    SELECT ne2.ID
    FROM dbo.NameEvent ne2
    LEFT JOIN dbo.NamePhoto np ON ne2.ID = np.npID
    LEFT JOIN dbo.Pictures p ON np.npFileName = p.PFileName
    WHERE ne2.neType = 'E' 
        AND ne2.EventDate IS NOT NULL
        AND p.PYear IS NOT NULL
        AND p.PYear BETWEEN 1900 AND 2100
    GROUP BY ne2.ID, ne2.neName, ne2.EventDate
    HAVING 
        YEAR(ne2.EventDate) < MIN(p.PYear) OR
        YEAR(ne2.EventDate) > MAX(p.PYear) OR
        (COUNT(DISTINCT p.PYear) > 1 AND ne2.neName NOT LIKE '%' + CAST(YEAR(ne2.EventDate) AS VARCHAR) + '%')
);

SELECT @@ROWCOUNT AS 'Rows Updated';
*/
