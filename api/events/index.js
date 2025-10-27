const { query } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Events API function processed a request.');

    try {
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
