const { query } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Events API function processed a request.');

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

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: events
        };

    } catch (error) {
        context.log.error('Error:', error);
        context.res = {
            status: 500,
            body: { error: 'Internal server error', message: error.message }
        };
    }
};
