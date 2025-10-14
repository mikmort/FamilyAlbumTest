const { app } = require('@azure/functions');
const { query } = require('../shared/db');

app.http('events', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log(`Http function processed request for url "${request.url}"`);

        try {
            const eventsQuery = `
                SELECT DISTINCT
                    CAST(PEventDate AS DATE) as date,
                    COUNT(*) as count
                FROM dbo.Pictures
                WHERE PEventDate IS NOT NULL
                GROUP BY CAST(PEventDate AS DATE)
                ORDER BY date DESC
            `;

            const events = await query(eventsQuery);

            return {
                status: 200,
                jsonBody: events
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
