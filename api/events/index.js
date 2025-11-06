const { query, execute } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('Events API function processed a request.');
    
    const method = req.method;
    const id = context.bindingData.id;

    // GET requests require 'Read', write operations require 'Full'
    const requiredRole = (method === 'GET') ? 'Read' : 'Full';
    
    const authResult = await checkAuthorization(context, requiredRole);
    if (!authResult.authorized) {
        context.res = {
            status: authResult.status,
            headers: { 'Content-Type': 'application/json' },
            body: { error: authResult.message }
        };
        return;
    }

    try {
        // GET /api/events - List all events
        if (method === 'GET' && !id) {
            const eventsQuery = `
                SELECT 
                    ID,
                    neName,
                    neRelation,
                    neType,
                    neDateLastModified,
                    ISNULL(neCount, 0) as neCount
                FROM dbo.NameEvent WITH (NOLOCK)
                WHERE neType = 'E'
                ORDER BY neName
            `;

            const events = await query(eventsQuery);

            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: {
                    success: true,
                    events: events
                }
            };
            return;
        }

        // GET /api/events/[id] - Get specific event
        if (method === 'GET' && id) {
            const eventQuery = `
                SELECT 
                    ID,
                    neName,
                    neRelation,
                    neType,
                    neDateLastModified,
                    ISNULL(neCount, 0) as neCount
                FROM dbo.NameEvent
                WHERE ID = @id AND neType = 'E'
            `;

            const result = await query(eventQuery, { id: parseInt(id) });

            if (result.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Event not found' }
                };
                return;
            }

            context.res = {
                status: 200,
                body: {
                    success: true,
                    event: result[0]
                }
            };
            return;
        }

        // POST /api/events - Create new event
        if (method === 'POST') {
            const { name, neName, relation, neRelation } = req.body;
            const eventName = name || neName;
            const eventRelation = relation || neRelation || null;

            if (!eventName || !eventName.trim()) {
                context.res = {
                    status: 400,
                    body: { error: 'Event name is required' }
                };
                return;
            }

            // Check if event already exists
            const existingQuery = `
                SELECT ID FROM dbo.NameEvent 
                WHERE neName = @name AND neType = 'E'
            `;
            const existing = await query(existingQuery, { name: eventName.trim() });

            if (existing.length > 0) {
                context.res = {
                    status: 400,
                    body: { error: 'Event with this name already exists' }
                };
                return;
            }

            // Insert new event
            const insertQuery = `
                INSERT INTO dbo.NameEvent (neName, neRelation, neType, neDateLastModified, neCount)
                VALUES (@name, @relation, 'E', GETDATE(), 0);
                SELECT SCOPE_IDENTITY() as ID;
            `;

            const result = await query(insertQuery, {
                name: eventName.trim(),
                relation: eventRelation
            });

            const newId = result[0].ID;

            // Fetch the created event
            const createdEvent = await query(
                `SELECT ID, neName, neRelation, neType, neDateLastModified, neCount 
                 FROM dbo.NameEvent WHERE ID = @id`,
                { id: newId }
            );

            context.res = {
                status: 201,
                body: {
                    success: true,
                    event: createdEvent[0],
                    // Also return alternate field names for compatibility
                    id: newId,
                    name: eventName.trim(),
                    relation: eventRelation
                }
            };
            return;
        }

        // PUT /api/events/[id] or PUT /api/events - Update event
        if (method === 'PUT') {
            // Accept ID from URL path or request body (for compatibility)
            const { name, neName, relation, neRelation, id: bodyId } = req.body;
            const eventId = id || bodyId;
            const eventName = name || neName;
            const eventRelation = relation || neRelation;

            context.log(`📝 Updating event ${eventId}: name="${eventName}", relation="${eventRelation}"`);

            if (!eventId) {
                context.res = {
                    status: 400,
                    body: { error: 'Event ID is required' }
                };
                return;
            }

            if (!eventName || !eventName.trim()) {
                context.res = {
                    status: 400,
                    body: { error: 'Event name is required' }
                };
                return;
            }

            // Check if event exists
            const existingQuery = `
                SELECT ID FROM dbo.NameEvent WHERE ID = @id AND neType = 'E'
            `;
            const existing = await query(existingQuery, { id: parseInt(eventId) });

            if (existing.length === 0) {
                context.log(`❌ Event ${eventId} not found`);
                context.res = {
                    status: 404,
                    body: { error: 'Event not found' }
                };
                return;
            }

            // Update event
            const updateQuery = `
                UPDATE dbo.NameEvent
                SET neName = @name,
                    neRelation = @relation,
                    neDateLastModified = GETDATE()
                WHERE ID = @id AND neType = 'E'
            `;

            await execute(updateQuery, {
                id: parseInt(eventId),
                name: eventName.trim(),
                relation: eventRelation || null
            });

            context.log(`✅ Event ${eventId} updated successfully`);

            // Fetch updated event
            const updatedEvent = await query(
                `SELECT ID, neName, neRelation, neType, neDateLastModified, neCount 
                 FROM dbo.NameEvent WHERE ID = @id`,
                { id: parseInt(eventId) }
            );

            context.res = {
                status: 200,
                body: {
                    success: true,
                    event: updatedEvent[0]
                }
            };
            return;
        }

        // DELETE /api/events/[id] - Delete event
        if (method === 'DELETE' && id) {
            // Check if event exists and get photo count
            const eventQuery = `
                SELECT ID, neName, neCount 
                FROM dbo.NameEvent 
                WHERE ID = @id AND neType = 'E'
            `;
            const result = await query(eventQuery, { id: parseInt(id) });

            if (result.length === 0) {
                context.res = {
                    status: 404,
                    body: { error: 'Event not found' }
                };
                return;
            }

            const event = result[0];

            // Don't allow deletion if event has tagged photos
            if (event.neCount > 0) {
                context.res = {
                    status: 400,
                    body: { 
                        error: `Cannot delete event "${event.neName}" because it has ${event.neCount} tagged photos. Remove all tags first.` 
                    }
                };
                return;
            }

            // Delete the event
            const deleteQuery = `
                DELETE FROM dbo.NameEvent 
                WHERE ID = @id AND neType = 'E'
            `;
            await execute(deleteQuery, { id: parseInt(id) });

            context.res = {
                status: 200,
                body: {
                    success: true,
                    message: `Event "${event.neName}" deleted successfully`
                }
            };
            return;
        }

        // Method not allowed
        context.res = {
            status: 405,
            body: { error: 'Method not allowed' }
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { 
                success: false,
                error: 'Internal server error', 
                message: error.message 
            }
        };
    }
};
