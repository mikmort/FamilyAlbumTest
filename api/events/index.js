const { query } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Events API function processed a request.');

    try {
        const eventsQuery = `
            SELECT 
                CONCAT(PYear, '-', RIGHT('0' + CAST(PMonth AS VARCHAR), 2), '-01') as date,
                COUNT(*) as count
            FROM dbo.Pictures
            WHERE PYear IS NOT NULL AND PMonth IS NOT NULL
            GROUP BY PYear, PMonth
            ORDER BY PYear DESC, PMonth DESC
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
