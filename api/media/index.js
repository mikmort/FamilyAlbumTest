const { query, execute } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Media API function processed a request.');

    const method = req.method;
    
    // Extract filename from URL path: /api/media/{filename}
    // req.url might be like "/api/media/On%20Location%5CFile.jpg"
    let filename = null;
    if (req.url) {
        const urlMatch = req.url.match(/^\/api\/media\/(.+?)(?:\?|$)/);
        if (urlMatch && urlMatch[1]) {
            filename = decodeURIComponent(urlMatch[1]);
        }
    }
    
    // Fallback to route params if URL parsing didn't work
    if (!filename && req.params && req.params.filename) {
        filename = decodeURIComponent(req.params.filename);
        if (filename === '' || filename === '/') {
            filename = null;
        }
    }

    context.log(`Method: ${method}, URL: ${req.url}, Filename: ${filename}`);

    try {
        // GET /api/media/{filename} - Get specific media item
        if (method === 'GET' && filename) {
            const mediaQuery = `SELECT * FROM dbo.Pictures WHERE PFileName = @filename`;
            const mediaResult = await query(mediaQuery, { filename });

            if (mediaResult.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Media not found' }
                };
                return;
            }

            const media = mediaResult[0];

            // Get tagged people
            const peopleQuery = `
                SELECT 
                    ne.ID as id,
                    ne.neName as name,
                    np.npPosition as position
                FROM dbo.NamePhoto np
                INNER JOIN dbo.NameEvent ne ON np.npID = ne.ID
                WHERE np.npFileName = @filename
            `;
            const people = await query(peopleQuery, { filename });

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { ...media, taggedPeople: people }
            };
            return;
        }

        // GET /api/media - List all media with optional filters
        if (method === 'GET' && !filename) {
            const peopleIds = req.query.peopleIds ? req.query.peopleIds.split(',').map(id => parseInt(id)) : [];
            const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
            const noPeople = req.query.noPeople === 'true';
            const sortOrder = req.query.sortOrder || 'desc';
            const exclusiveFilter = req.query.exclusiveFilter === 'true';

            let mediaQuery = `
                SELECT DISTINCT p.*
                FROM dbo.Pictures p
            `;
            
            const whereClauses = [];
            const params = {};

            // Filter by people
            if (peopleIds.length > 0) {
                if (exclusiveFilter) {
                    // Exclusive: photo must have ONLY the selected people (and no others)
                    // This is complex - for now, implement inclusive filter
                    const personPlaceholders = peopleIds.map((_, i) => `@person${i}`).join(',');
                    whereClauses.push(`
                        EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            WHERE np.npFileName = p.PFileName 
                            AND np.npID IN (${personPlaceholders})
                        )
                    `);
                    peopleIds.forEach((id, i) => {
                        params[`person${i}`] = id;
                    });
                } else {
                    // Inclusive: photo must have at least one of the selected people
                    const personPlaceholders = peopleIds.map((_, i) => `@person${i}`).join(',');
                    whereClauses.push(`
                        EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            WHERE np.npFileName = p.PFileName 
                            AND np.npID IN (${personPlaceholders})
                        )
                    `);
                    peopleIds.forEach((id, i) => {
                        params[`person${i}`] = id;
                    });
                }
            }

            // Filter by event
            if (eventId) {
                whereClauses.push(`
                    EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        WHERE np.npFileName = p.PFileName 
                        AND np.npID = @eventId
                    )
                `);
                params.eventId = eventId;
            }

            // Filter for photos with no people
            if (noPeople) {
                whereClauses.push(`
                    NOT EXISTS (
                        SELECT 1 FROM dbo.NamePhoto np 
                        WHERE np.npFileName = p.PFileName
                    )
                `);
            }

            if (whereClauses.length > 0) {
                mediaQuery += ` WHERE ${whereClauses.join(' AND ')}`;
            }

            // Sorting
            const orderDirection = sortOrder === 'asc' ? 'ASC' : 'DESC';
            mediaQuery += ` ORDER BY p.PYear ${orderDirection}, p.PMonth ${orderDirection}, p.PFileName ${orderDirection}`;

            const media = await query(mediaQuery, params);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: media
            };
            return;
        }

        // POST /api/media/{filename}/tags - Tag a person in a photo
        if (method === 'POST' && filename) {
            const { personId, position } = req.body;

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            const insertQuery = `
                INSERT INTO dbo.NamePhoto (npFileName, npID, npPosition)
                VALUES (@filename, @personId, @position)
            `;

            await execute(insertQuery, {
                filename,
                personId,
                position: position || 0
            });

            context.res = {
                status: 201,
                body: { success: true }
            };
            return;
        }

        // DELETE /api/media/{filename}/tags/{personId} - Remove person tag
        if (method === 'DELETE' && filename) {
            const { personId } = req.body;

            if (!personId) {
                context.res = {
                    status: 400,
                    body: { error: 'Person ID is required' }
                };
                return;
            }

            const deleteQuery = `
                DELETE FROM dbo.NamePhoto
                WHERE npFileName = @filename AND npID = @personId
            `;

            await execute(deleteQuery, { filename, personId });

            context.res = {
                status: 204
            };
            return;
        }

        context.res = {
            status: 405,
            body: { error: 'Method not allowed' }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error', message: error.message }
        };
    }
};
