const { query, execute } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Media API function processed a request.');

    const method = req.method;
    const filename = req.params.filename ? decodeURIComponent(req.params.filename) : null;

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
            const personId = req.query.personId;
            const year = req.query.year;
            const month = req.query.month;

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
                        WHERE np.npFileName = p.PFileName 
                        AND np.npID = @personId
                    )
                `;
                params.personId = personId;
            }

            if (year) {
                mediaQuery += ` AND p.PYear = @year`;
                params.year = year;
            }

            if (month) {
                mediaQuery += ` AND p.PMonth = @month`;
                params.month = month;
            }

            mediaQuery += ` ORDER BY p.PYear DESC, p.PMonth DESC, p.PFileName`;

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
