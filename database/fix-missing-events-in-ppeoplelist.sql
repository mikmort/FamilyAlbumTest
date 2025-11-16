-- Fix Missing Events in PPeopleList
-- This script finds events (neType='E') in NamePhoto that are missing from PPeopleList
-- and adds them to the beginning of PPeopleList for their corresponding photos

-- First, let's see what we're dealing with
-- Show photos that have events in NamePhoto but not in PPeopleList
SELECT 
    p.PFileName,
    p.PPeopleList,
    np.npID as EventInNamePhoto,
    ne.neName as EventName,
    CASE 
        WHEN p.PPeopleList IS NULL OR p.PPeopleList = '' THEN 'Empty PPeopleList'
        WHEN ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%' THEN 'Event Missing from PPeopleList'
        ELSE 'Event Present'
    END as Status
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
WHERE 
    -- Event is in NamePhoto but NOT in PPeopleList
    (p.PPeopleList IS NULL OR p.PPeopleList = '' OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%')
ORDER BY p.PFileName;

-- Count of affected photos
SELECT COUNT(DISTINCT p.PFileName) as PhotosNeedingFix
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
WHERE 
    (p.PPeopleList IS NULL OR p.PPeopleList = '' OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%');

-- Now fix them by prepending the event ID to PPeopleList
-- Using a cursor to update each photo individually

DECLARE @filename VARCHAR(255);
DECLARE @currentPPeopleList VARCHAR(MAX);
DECLARE @eventID INT;
DECLARE @newPPeopleList VARCHAR(MAX);

DECLARE event_cursor CURSOR FOR
SELECT DISTINCT
    p.PFileName,
    p.PPeopleList,
    np.npID
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
WHERE 
    (p.PPeopleList IS NULL OR p.PPeopleList = '' OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%');

OPEN event_cursor;

FETCH NEXT FROM event_cursor INTO @filename, @currentPPeopleList, @eventID;

WHILE @@FETCH_STATUS = 0
BEGIN
    -- Build new PPeopleList with event ID at the beginning
    IF @currentPPeopleList IS NULL OR @currentPPeopleList = ''
        SET @newPPeopleList = CAST(@eventID AS VARCHAR);
    ELSE
        SET @newPPeopleList = CAST(@eventID AS VARCHAR) + ',' + @currentPPeopleList;
    
    -- Update the Pictures table
    UPDATE dbo.Pictures
    SET PPeopleList = @newPPeopleList,
        PLastModifiedDate = GETDATE()
    WHERE PFileName = @filename;
    
    PRINT 'Updated ' + @filename + ': ' + ISNULL(@currentPPeopleList, '(empty)') + ' -> ' + @newPPeopleList;
    
    FETCH NEXT FROM event_cursor INTO @filename, @currentPPeopleList, @eventID;
END;

CLOSE event_cursor;
DEALLOCATE event_cursor;

PRINT 'Fix completed!';

-- Verify the fix
SELECT 
    'After Fix' as Stage,
    COUNT(DISTINCT p.PFileName) as PhotosNeedingFix
FROM dbo.Pictures p
INNER JOIN dbo.NamePhoto np ON np.npFileName = p.PFileName
INNER JOIN dbo.NameEvent ne ON ne.ID = np.npID AND ne.neType = 'E'
WHERE 
    (p.PPeopleList IS NULL OR p.PPeopleList = '' OR ',' + p.PPeopleList + ',' NOT LIKE '%,' + CAST(np.npID AS VARCHAR) + ',%');
