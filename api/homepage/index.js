const { query, DatabaseWarmupError } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('Homepage API called');

    try {
        // Check if database is configured
        if (!process.env.AZURE_SQL_SERVER || !process.env.AZURE_SQL_DATABASE) {
            context.log.warn('Database credentials not configured, returning empty homepage data');
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    onThisDay: [],
                    recentUploads: [],
                    totalPhotos: 0,
                    totalPeople: 0,
                    totalEvents: 0,
                    featuredPerson: null,
                    featuredEvent: null,
                    randomSuggestion: null
                }
            };
            return;
        }

        // Check authorization (Read permission required)
        const { authorized, user, error } = await checkAuthorization(context, 'Read');
        if (!authorized) {
            context.res = {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
                body: { error }
            };
            return;
        }
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
        const currentDay = today.getDate();

        // Get "On This Day" photos - photos taken in this month in past years
        // Note: Database only stores PMonth and PYear, not the specific day
        const onThisDayQuery = `
            SELECT TOP 12
                p.*
            FROM dbo.Pictures p
            WHERE p.PMonth = @month
            ORDER BY p.PYear DESC, p.PDateEntered DESC
        `;
        
        const onThisDay = await query(onThisDayQuery, { 
            month: currentMonth
        });

        // Get recent uploads (last 60 days)
        const recentUploadsQuery = `
            SELECT 
                p.*
            FROM dbo.Pictures p
            WHERE p.PDateEntered >= DATEADD(day, -60, GETDATE())
            ORDER BY p.PDateEntered DESC
        `;
        
        const recentUploads = await query(recentUploadsQuery);

        // Build NameEvent lookup for all IDs in PPeopleList across all media items
        const allMedia = [...onThisDay, ...recentUploads];
        const eventLookup = {};
        
        if (allMedia.length > 0) {
            // Collect all numeric IDs from PPeopleList
            const candidateIds = new Set();
            allMedia.forEach(item => {
                const ppl = item.PPeopleList || '';
                if (!ppl) return;
                const tokens = ppl.split(',').map(s => s.trim()).filter(Boolean);
                tokens.forEach(tok => {
                    if (/^\d+$/.test(tok)) candidateIds.add(parseInt(tok));
                });
            });

            // Batch query NameEvent for all candidate IDs
            if (candidateIds.size > 0) {
                const ids = Array.from(candidateIds);
                const idPlaceholders = ids.map((_, i) => `@id${i}`).join(',');
                const eventQuery = `SELECT ID, neName, neRelation, neType FROM dbo.NameEvent WHERE ID IN (${idPlaceholders})`;
                const eventParams = {};
                ids.forEach((id, i) => { eventParams[`id${i}`] = id; });
                
                const eventRows = await query(eventQuery, eventParams);
                eventRows.forEach(r => {
                    eventLookup[r.ID] = { ID: r.ID, neName: r.neName, neType: r.neType, neRelation: r.neRelation };
                });
            }
        }

        // Get total stats
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM dbo.Pictures) as totalPhotos,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') as totalPeople,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') as totalEvents
        `;
        
        const stats = await query(statsQuery);
        const { totalPhotos, totalPeople, totalEvents } = stats[0] || { totalPhotos: 0, totalPeople: 0, totalEvents: 0 };

        // Calculate week number for consistent randomization across all users
        // This ensures the same featured person/event is shown to everyone during the same week
        const weeksSinceEpoch = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

        // Get a featured person (random family member with photos, consistent per week)
        const featuredPersonQuery = `
            WITH FamilyMembers AS (
                SELECT 
                    ne.ID,
                    ne.neName,
                    ne.neRelation,
                    (SELECT COUNT(*) FROM dbo.NamePhoto np WHERE np.npID = ne.ID) as neCount,
                    ROW_NUMBER() OVER (ORDER BY CHECKSUM(ne.ID + @weekSeed)) as RowNum
                FROM dbo.NameEvent ne
                WHERE ne.neType = 'N'
                AND ne.IsFamilyMember = 1
                AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.npID = ne.ID)
            )
            SELECT TOP 1 ID, neName, neRelation, neCount
            FROM FamilyMembers
            ORDER BY RowNum
        `;
        
        const featuredPersonResult = await query(featuredPersonQuery, { weekSeed: weeksSinceEpoch });
        const featuredPerson = featuredPersonResult.length > 0 ? featuredPersonResult[0] : null;

        // Get a featured event (consistent per week)
        const featuredEventQuery = `
            WITH RankedEvents AS (
                SELECT 
                    ne.ID,
                    ne.neName,
                    ne.neRelation,
                    (SELECT COUNT(*) FROM dbo.NamePhoto np WHERE np.npID = ne.ID) as neCount,
                    ROW_NUMBER() OVER (ORDER BY CHECKSUM(ne.ID + @weekSeed)) as RowNum
                FROM dbo.NameEvent ne
                WHERE ne.neType = 'E'
                AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.npID = ne.ID)
            )
            SELECT TOP 1 ID, neName, neRelation, neCount
            FROM RankedEvents
            ORDER BY RowNum
        `;
        
        const featuredEventResult = await query(featuredEventQuery, { weekSeed: weeksSinceEpoch });
        const featuredEvent = featuredEventResult.length > 0 ? featuredEventResult[0] : null;

        // Get a random suggestion (event the user might not have visited recently, consistent per week)
        const randomSuggestionQuery = `
            WITH RankedSuggestions AS (
                SELECT 
                    ne.ID,
                    ne.neName,
                    ne.neRelation,
                    ROW_NUMBER() OVER (ORDER BY CHECKSUM(ne.ID + @weekSeed + 1000)) as RowNum
                FROM dbo.NameEvent ne
                WHERE ne.neType = 'E'
                AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.npID = ne.ID)
            )
            SELECT TOP 1 ID, neName, neRelation
            FROM RankedSuggestions
            ORDER BY RowNum
        `;
        
        const randomSuggestionResult = await query(randomSuggestionQuery, { weekSeed: weeksSinceEpoch });
        const randomSuggestion = randomSuggestionResult.length > 0 ? randomSuggestionResult[0] : null;

        // Helper function to transform media items with URLs and Event data
        const transformMedia = (mediaItems) => {
            return mediaItems.map(item => {
                let blobPath = (item.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
                blobPath = blobPath.split('/').map(s => s.trim()).join('/');
                
                const encodedBlobPath = blobPath.split('/').map(encodeURIComponent).join('/');
                const thumbnailUrl = item.PThumbnailUrl 
                    ? item.PThumbnailUrl 
                    : `/api/media/${encodedBlobPath}?thumbnail=true`;
                
                const blobUrl = `/api/media/${encodedBlobPath}`;
                
                // Extract event from PPeopleList
                let eventForItem = null;
                if (item.PPeopleList) {
                    const tokens = item.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);
                    const numericIds = tokens.filter(tok => /^\d+$/.test(tok)).map(tok => parseInt(tok));
                    for (const id of numericIds) {
                        const lookup = eventLookup[id];
                        if (lookup && lookup.neType === 'E') {
                            eventForItem = { ID: lookup.ID, neName: lookup.neName };
                            break;
                        }
                    }
                }
                
                return {
                    ...item,
                    PBlobUrl: blobUrl,
                    PThumbnailUrl: thumbnailUrl,
                    Event: eventForItem
                };
            });
        };

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                onThisDay: transformMedia(onThisDay),
                recentUploads: transformMedia(recentUploads),
                totalPhotos,
                totalPeople,
                totalEvents,
                featuredPerson,
                featuredEvent,
                randomSuggestion
            }
        };
        
    } catch (err) {
        context.log.error('Homepage API error:', err);
        
        // Check if this is a database warmup error
        if (err.isWarmupError || err instanceof DatabaseWarmupError) {
            context.res = {
                status: 503, // Service Unavailable
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    error: 'Database is warming up. Please wait a moment and try again.',
                    databaseWarming: true
                }
            };
            return;
        }
        
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to load homepage data', details: err.message }
        };
    }
};
