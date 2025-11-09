const { query } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('Homepage API called');

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

    try {
        const today = new Date();
        const currentMonth = today.getMonth() + 1; // JavaScript months are 0-indexed
        const currentDay = today.getDate();

        // Get "On This Day" photos - photos taken on this day in past years
        const onThisDayQuery = `
            SELECT TOP 12
                p.*
            FROM dbo.Pictures p
            WHERE p.PMonth = @month AND DAY(DATEADD(day, p.PTime, '1900-01-01')) = @day
            ORDER BY p.PYear DESC
        `;
        
        const onThisDay = await query(onThisDayQuery, { 
            month: currentMonth, 
            day: currentDay 
        });

        // Get recent uploads
        const recentUploadsQuery = `
            SELECT TOP 12
                p.*
            FROM dbo.Pictures p
            ORDER BY p.PDateEntered DESC
        `;
        
        const recentUploads = await query(recentUploadsQuery);

        // Get total stats
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM dbo.Pictures) as totalPhotos,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') as totalPeople,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') as totalEvents
        `;
        
        const stats = await query(statsQuery);
        const { totalPhotos, totalPeople, totalEvents } = stats[0] || { totalPhotos: 0, totalPeople: 0, totalEvents: 0 };

        // Get a featured person (random person with photos)
        const featuredPersonQuery = `
            SELECT TOP 1
                ne.ID,
                ne.neName,
                ne.neRelation,
                (SELECT COUNT(*) FROM dbo.NamePhoto np WHERE np.neID = ne.ID) as neCount
            FROM dbo.NameEvent ne
            WHERE ne.neType = 'N'
            AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.neID = ne.ID)
            ORDER BY NEWID()
        `;
        
        const featuredPersonResult = await query(featuredPersonQuery);
        const featuredPerson = featuredPersonResult.length > 0 ? featuredPersonResult[0] : null;

        // Get a featured event
        const featuredEventQuery = `
            SELECT TOP 1
                ne.ID,
                ne.neName,
                ne.neRelation,
                (SELECT COUNT(*) FROM dbo.NamePhoto np WHERE np.neID = ne.ID) as neCount
            FROM dbo.NameEvent ne
            WHERE ne.neType = 'E'
            AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.neID = ne.ID)
            ORDER BY NEWID()
        `;
        
        const featuredEventResult = await query(featuredEventQuery);
        const featuredEvent = featuredEventResult.length > 0 ? featuredEventResult[0] : null;

        // Get a random suggestion (event the user might not have visited recently)
        const randomSuggestionQuery = `
            SELECT TOP 1
                ne.ID,
                ne.neName,
                ne.neRelation
            FROM dbo.NameEvent ne
            WHERE ne.neType = 'E'
            AND EXISTS (SELECT 1 FROM dbo.NamePhoto np WHERE np.neID = ne.ID)
            ORDER BY NEWID()
        `;
        
        const randomSuggestionResult = await query(randomSuggestionQuery);
        const randomSuggestion = randomSuggestionResult.length > 0 ? randomSuggestionResult[0] : null;

        // Helper function to transform media items with URLs
        const transformMedia = (mediaItems) => {
            return mediaItems.map(item => {
                let blobPath = (item.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
                blobPath = blobPath.split('/').map(s => s.trim()).join('/');
                
                const encodedBlobPath = blobPath.split('/').map(encodeURIComponent).join('/');
                const thumbnailUrl = item.PThumbnailUrl 
                    ? item.PThumbnailUrl 
                    : `/api/media/${encodedBlobPath}?thumbnail=true`;
                
                const blobUrl = `/api/media/${encodedBlobPath}`;
                
                return {
                    ...item,
                    PBlobUrl: blobUrl,
                    PThumbnailUrl: thumbnailUrl
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
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to load homepage data', details: err.message }
        };
    }
};
