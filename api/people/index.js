const { app } = require('@azure/functions');
const { query, execute } = require('../shared/db');

app.http('people', {
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        const method = request.method;

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

                return {
                    status: 200,
                    jsonBody: people
                };
            }

            // POST /api/people - Create new person
            if (method === 'POST') {
                const body = await request.json();
                const { name } = body;

                if (!name) {
                    return {
                        status: 400,
                        jsonBody: { error: 'Name is required' }
                    };
                }

                const insertQuery = `
                    INSERT INTO dbo.NameEvent (NameLName, neCount)
                    OUTPUT INSERTED.NameID, INSERTED.NameLName as name, INSERTED.neCount as photoCount
                    VALUES (@name, 0)
                `;

                const result = await query(insertQuery, { name });

                return {
                    status: 201,
                    jsonBody: result[0]
                };
            }

            // PUT /api/people/{id} - Update person
            if (method === 'PUT') {
                const body = await request.json();
                const { id, name } = body;

                if (!id || !name) {
                    return {
                        status: 400,
                        jsonBody: { error: 'ID and name are required' }
                    };
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
                    return {
                        status: 404,
                        jsonBody: { error: 'Person not found' }
                    };
                }

                return {
                    status: 200,
                    jsonBody: result[0]
                };
            }

            // DELETE /api/people/{id} - Delete person
            if (method === 'DELETE') {
                const body = await request.json();
                const { id } = body;

                if (!id) {
                    return {
                        status: 400,
                        jsonBody: { error: 'ID is required' }
                    };
                }

                // Delete associations first
                const deleteAssocQuery = `DELETE FROM dbo.NamePhoto WHERE NameID = @id`;
                await execute(deleteAssocQuery, { id });

                // Delete person
                const deleteQuery = `DELETE FROM dbo.NameEvent WHERE NameID = @id`;
                await execute(deleteQuery, { id });

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
