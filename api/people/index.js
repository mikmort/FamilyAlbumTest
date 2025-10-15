const { query, execute } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('People API function processed a request.');

    const method = req.method;

    try {
        // GET /api/people - List all people
        if (method === 'GET') {
            const peopleQuery = `
                SELECT 
                    NameID,
                    NameLName as name,
                    ISNULL(neCount, 0) as photoCount
                FROM dbo.NameEvent
                ORDER BY NameLName
            `;
            const people = await query(peopleQuery);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: people
            };
            return;
        }

        // POST /api/people - Create new person
        if (method === 'POST') {
            const { name } = req.body;

            if (!name) {
                context.res = {
                    status: 400,
                    body: { error: 'Name is required' }
                };
                return;
            }

            const insertQuery = `
                INSERT INTO dbo.NameEvent (NameLName, neCount)
                OUTPUT INSERTED.NameID, INSERTED.NameLName as name, INSERTED.neCount as photoCount
                VALUES (@name, 0)
            `;

            const result = await query(insertQuery, { name });

            context.res = {
                status: 201,
                body: result[0]
            };
            return;
        }

        // PUT /api/people - Update person
        if (method === 'PUT') {
            const { id, name } = req.body;

            if (!id || !name) {
                context.res = {
                    status: 400,
                    body: { error: 'ID and name are required' }
                };
                return;
            }

            const updateQuery = `
                UPDATE dbo.NameEvent 
                SET NameLName = @name
                WHERE NameID = @id
            `;

            await execute(updateQuery, { id, name });

            const selectQuery = `
                SELECT NameID, NameLName as name, neCount as photoCount
                FROM dbo.NameEvent
                WHERE NameID = @id
            `;

            const result = await query(selectQuery, { id });

            if (result.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Person not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                body: result[0]
            };
            return;
        }

        // DELETE /api/people - Delete person
        if (method === 'DELETE') {
            const { id } = req.body;

            if (!id) {
                context.res = {
                    status: 400,
                    body: { error: 'ID is required' }
                };
                return;
            }

            // Delete associations first
            const deleteAssocQuery = `DELETE FROM dbo.NamePhoto WHERE NameID = @id`;
            await execute(deleteAssocQuery, { id });

            // Delete person
            const deleteQuery = `DELETE FROM dbo.NameEvent WHERE NameID = @id`;
            await execute(deleteQuery, { id });

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
