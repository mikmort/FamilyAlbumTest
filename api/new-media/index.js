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
                    p.*
                FROM dbo.Pictures p
                WHERE p.PDateEntered > @lastViewedTime
                ORDER BY p.PDateEntered DESC
            `;
            
            const newMedia = await query(newMediaQuery, { lastViewedTime });
            
            context.log(`Found ${newMedia.length} new media items`);
            
            // Build event and people lookups (same logic as main media API)
            const eventLookup = {};
            
            if (newMedia.length > 0) {
                // Collect all numeric IDs from PPeopleList to query NameEvent
                const candidateIds = new Set();
                newMedia.forEach(item => {
                    if (item.PPeopleList) {
                        const tokens = item.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);
                        tokens.forEach(tok => {
                            if (/^\d+$/.test(tok)) {
                                candidateIds.add(parseInt(tok, 10));
                            }
                        });
                    }
                });
                
                // Query NameEvent for all candidate IDs
                if (candidateIds.size > 0) {
                    const ids = Array.from(candidateIds);
                    const placeholders = ids.map((_, i) => `@id${i}`).join(',');
                    const eventQuery = `SELECT ID, neName, neRelation, neType FROM dbo.NameEvent WHERE ID IN (${placeholders})`;
                    const eventParams = {};
                    ids.forEach((id, i) => { eventParams[`id${i}`] = id; });
                    
                    const eventRows = await query(eventQuery, eventParams);
                    context.log(`Fetched ${eventRows.length} NameEvent records for PPeopleList IDs`);
                    eventRows.forEach(r => {
                        eventLookup[r.ID] = { ID: r.ID, neName: r.neName, neType: r.neType, neRelation: r.neRelation };
                    });
                }
            }
            
            // Transform results to include TaggedPeople and Event
            const transformedMedia = newMedia.map(item => {
                let blobPath = (item.PFileName || '').replace(/\\/g, '/').replace(/\/\//g, '/');
                blobPath = blobPath.split('/').map(s => s.trim()).join('/');
                
                context.log(`Transforming media item: ${item.PFileName}`);
                context.log(`  Blob path: ${blobPath}`);
                context.log(`  PType: ${item.PType}`);
                
                // Determine event from PPeopleList
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
                
                // Build TaggedPeople from PPeopleList (only people, not events)
                let orderedTagged = [];
                if (item.PPeopleList) {
                    const tokens = item.PPeopleList.split(',').map(s => s.trim()).filter(Boolean);
                    for (const tok of tokens) {
                        if (/^\d+$/.test(tok)) {
                            const id = parseInt(tok, 10);
                            const lookup = eventLookup[id];
                            if (lookup && lookup.neType === 'N') {
                                orderedTagged.push({
                                    ID: lookup.ID,
                                    neName: lookup.neName,
                                    neRelation: lookup.neRelation
                                });
                            }
                        }
                    }
                }
                
                // Build URLs
                const encodedBlobPath = blobPath.split('/').map(encodeURIComponent).join('/');
                const thumbnailUrl = item.PThumbnailUrl 
                    ? item.PThumbnailUrl 
                    : `/api/media/${encodedBlobPath}?thumbnail=true`;
                
                const blobUrl = `/api/media/${encodedBlobPath}`;
                
                context.log(`  Encoded blob path: ${encodedBlobPath}`);
                context.log(`  Final PBlobUrl: ${blobUrl}`);
                context.log(`  Final PThumbnailUrl: ${thumbnailUrl}`);
                
                return {
                    ...item,
                    PBlobUrl: blobUrl,
                    PThumbnailUrl: thumbnailUrl,
                    TaggedPeople: orderedTagged,
                    Event: eventForItem
                };
            });
            
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    count: transformedMedia.length,
                    lastViewedTime,
                    media: transformedMedia
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
