-- Common queries for Family Album application

-- Query 1: Get all people with their photo counts
SELECT 
    ID,
    neName as Name,
    neRelation as Relationship,
    neCount as PhotoCount,
    neDateLastModified as LastModified
FROM dbo.NameEvent
WHERE neType = 'N'
ORDER BY neName;

-- Query 2: Get all events with their photo counts
SELECT 
    ID,
    neName as EventName,
    neRelation as Details,
    neCount as PhotoCount,
    neDateLastModified as LastModified
FROM dbo.NameEvent
WHERE neType = 'E'
ORDER BY neName;

-- Query 3: Get photos for specific people (OR logic)
SELECT DISTINCT p.*
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
WHERE np.npID IN (1, 2, 3) -- Replace with actual person IDs
ORDER BY p.PYear DESC, p.PMonth DESC;

-- Query 4: Get photos with ALL specified people (AND logic)
SELECT p.*
FROM dbo.Pictures p
WHERE EXISTS (
    SELECT 1
    FROM dbo.NamePhoto np
    WHERE np.npFileName = p.PFileName
    GROUP BY np.npFileName
    HAVING COUNT(DISTINCT CASE WHEN np.npID IN (1, 2) THEN np.npID END) = 2
) -- Replace 2 with the count of person IDs you're searching for
ORDER BY p.PYear DESC, p.PMonth DESC;

-- Query 5: Get photos for a specific event
SELECT p.*
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON p.PFileName = np.npFileName
WHERE np.npID = 1 -- Replace with actual event ID
ORDER BY p.PYear DESC, p.PMonth DESC;

-- Query 6: Get people tagged in a specific photo
-- Note: Order is determined by PPeopleList in Pictures table, not by position
SELECT 
    ne.ID,
    ne.neName as Name,
    ne.neRelation as Relationship
FROM dbo.NameEvent ne
INNER JOIN dbo.NamePhoto np ON ne.ID = np.npID
WHERE ne.neType = 'N'
    AND np.npFileName = 'photo.jpg' -- Replace with actual filename
ORDER BY ne.ID;

-- Query 7: Get unindexed files ready for processing
SELECT 
    uiID,
    uiFileName,
    uiDirectory,
    uiThumbUrl,
    uiType,
    uiWidth,
    uiHeight,
    uiVtime,
    uiBlobUrl
FROM dbo.UnindexedFiles
WHERE uiStatus = 'N'
ORDER BY uiDateAdded;

-- Query 8: Search people by name (partial match)
SELECT 
    ID,
    neName as Name,
    neRelation as Relationship,
    neCount as PhotoCount
FROM dbo.NameEvent
WHERE neType = 'N'
    AND neName LIKE '%Smith%' -- Replace with search term
ORDER BY neName;

-- Query 9: Get photos with no people tagged
SELECT *
FROM dbo.Pictures
WHERE PNameCount = 0
    OR NOT EXISTS (
        SELECT 1 
        FROM dbo.NamePhoto np 
        INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
        WHERE np.npFileName = Pictures.PFileName 
        AND ne.neType = 'N'
    )
ORDER BY PYear DESC, PMonth DESC;

-- Query 10: Get photo count by year
SELECT 
    PYear,
    COUNT(*) as PhotoCount,
    SUM(CASE WHEN PType = 1 THEN 1 ELSE 0 END) as ImageCount,
    SUM(CASE WHEN PType = 2 THEN 1 ELSE 0 END) as VideoCount
FROM dbo.Pictures
WHERE PYear IS NOT NULL
GROUP BY PYear
ORDER BY PYear DESC;
