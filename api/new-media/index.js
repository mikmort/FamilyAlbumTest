const { query, execute } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('New Media API called');

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

    const userEmail = user.Email;
    context.log(`User: ${userEmail}`);

    try {
        if (req.method === 'GET') {
            // Get new media since user's last view
            
            // First, get user's last viewed time
            const lastViewedQuery = `
                SELECT lastViewedTime 
                FROM dbo.UserLastViewed 
                WHERE userEmail = @email
            `;
            
            const lastViewedResult = await query(lastViewedQuery, { email: userEmail });
            
            let lastViewedTime;
            if (lastViewedResult.length > 0) {
                lastViewedTime = lastViewedResult[0].lastViewedTime;
            } else {
                // First time user checks - show media from last 7 days
                lastViewedTime = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            }
            
            context.log(`Last viewed time for ${userEmail}: ${lastViewedTime}`);
            
            // Get media uploaded after last viewed time
            const newMediaQuery = `
                SELECT 
                    p.PFileName,
                    p.PFileDirectory,
                    p.PDescription,
                    p.PHeight,
                    p.PWidth,
                    p.PMonth,
                    p.PYear,
                    p.PPeopleList,
                    p.PNameCount,
                    p.PType,
                    p.PTime,
                    p.PDateEntered,
                    p.PLastModifiedDate,
                    p.PReviewed,
                    p.PBlobUrl,
                    p.PThumbnailUrl
                FROM dbo.Pictures p
                WHERE p.PDateEntered > @lastViewedTime
                ORDER BY p.PDateEntered DESC
            `;
            
            const newMedia = await query(newMediaQuery, { lastViewedTime });
            
            context.log(`Found ${newMedia.length} new media items`);
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    count: newMedia.length,
                    lastViewedTime,
                    media: newMedia
                }
            };
            
        } else if (req.method === 'POST') {
            // Mark as viewed - update user's last viewed time to now
            
            const now = new Date();
            
            // Try to update existing record
            const updateQuery = `
                UPDATE dbo.UserLastViewed 
                SET lastViewedTime = @now, updatedAt = @now
                WHERE userEmail = @email
            `;
            
            const result = await execute(updateQuery, { email: userEmail, now });
            
            // If no rows updated, insert new record
            if (result.rowsAffected[0] === 0) {
                const insertQuery = `
                    INSERT INTO dbo.UserLastViewed (userEmail, lastViewedTime, createdAt, updatedAt)
                    VALUES (@email, @now, @now, @now)
                `;
                
                await execute(insertQuery, { email: userEmail, now });
            }
            
            context.log(`Updated last viewed time for ${userEmail} to ${now}`);
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    success: true,
                    lastViewedTime: now
                }
            };
            
        } else {
            context.res = {
                status: 405,
                headers: { 'Content-Type': 'application/json' },
                body: { error: 'Method not allowed. Use GET or POST.' }
            };
        }
        
    } catch (err) {
        context.log.error('New Media API error:', err);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to process new media request', details: err.message }
        };
    }
};
