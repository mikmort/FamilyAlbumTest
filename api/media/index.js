const { app } = require('@azure/functions');
const { query, execute } = require('../shared/db');

app.http('media', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const method = request.method;
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(Boolean);
        
        // Extract filename from path like /api/media/{filename}
        const filename = pathParts.length > 2 ? decodeURIComponent(pathParts[2]) : null;

        try {
            // GET /api/media/{filename} - Get specific media item
            if (method === 'GET' && filename) {
                const mediaQuery = `SELECT * FROM dbo.Pictures WHERE PFileName = @filename`;
                const mediaResult = await query(mediaQuery, { filename });

                if (mediaResult.length === 0) {
                    return {
                        status: 404,
                        jsonBody: { error: 'Media not found' }
                    };
                }

                const media = mediaResult[0];

                // Get tagged people
                const peopleQuery = `
                    SELECT 
                        ne.NameID,
                        ne.NameLName as name,
                        np.npXPos as xPos,
                        np.npYPos as yPos
                    FROM dbo.NamePhoto np
                    INNER JOIN dbo.NameEvent ne ON np.NameID = ne.NameID
                    WHERE np.PFileName = @filename
                `;
                const people = await query(peopleQuery, { filename });

                return {
                    status: 200,
                    jsonBody: { ...media, taggedPeople: people }
                };
            }

            // GET /api/media - List all media with optional filters
            if (method === 'GET' && !filename) {
                const personId = url.searchParams.get('personId');
                const eventDate = url.searchParams.get('eventDate');

                let mediaQuery = `
                    SELECT DISTINCT p.*
                    FROM dbo.Pictures p
                    WHERE 1=1
                `;
                const params = {};

                if (personId) {
                    mediaQuery += ` 
                        AND EXISTS (
                            SELECT 1 FROM dbo.NamePhoto np 
                            WHERE np.PFileName = p.PFileName 
                            AND np.NameID = @personId
                        )
                    `;
                    params.personId = personId;
                }

                if (eventDate) {
                    mediaQuery += ` AND CAST(p.PEventDate AS DATE) = @eventDate`;
                    params.eventDate = eventDate;
                }

                mediaQuery += ` ORDER BY p.PEventDate DESC, p.PFileName`;

                const media = await query(mediaQuery, params);

                return {
                    status: 200,
                    jsonBody: media
                };
            }

            // POST /api/media/{filename}/tags - Tag a person in a photo
            if (method === 'POST' && filename) {
                const body = await request.json();
                const { personId, xPos, yPos } = body;

                if (!personId) {
                    return {
                        status: 400,
                        jsonBody: { error: 'Person ID is required' }
                    };
                }

                const insertQuery = `
                    INSERT INTO dbo.NamePhoto (PFileName, NameID, npXPos, npYPos)
                    VALUES (@filename, @personId, @xPos, @yPos)
                `;

                await execute(insertQuery, {
                    filename,
                    personId,
                    xPos: xPos || 0,
                    yPos: yPos || 0
                });

                return {
                    status: 201,
                    jsonBody: { success: true }
                };
            }

            // DELETE /api/media/{filename}/tags/{personId} - Remove person tag
            if (method === 'DELETE' && filename) {
                const body = await request.json();
                const { personId } = body;

                if (!personId) {
                    return {
                        status: 400,
                        jsonBody: { error: 'Person ID is required' }
                    };
                }

                const deleteQuery = `
                    DELETE FROM dbo.NamePhoto
                    WHERE PFileName = @filename AND NameID = @personId
                `;

                await execute(deleteQuery, { filename, personId });

                return {
                    status: 204
                };
            }

            return {
                status: 405,
                jsonBody: { error: 'Method not allowed' }
            };

        } catch (error) {
            context.error('Error:', error);
            return {
                status: 500,
                jsonBody: { error: 'Internal server error', message: error.message }
            };
        }
    }
});
