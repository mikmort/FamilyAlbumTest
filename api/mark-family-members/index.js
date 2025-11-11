const { query, execute } = require('../shared/db');
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
    context.log('Mark family members API called');

    try {
        // Check authorization (Admin permission required)
        const { authorized, error } = await checkAuthorization(context, 'Admin');
        if (!authorized) {
            context.res = {
                status: 403,
                headers: { 'Content-Type': 'application/json' },
                body: { error }
            };
            return;
        }

        // Mark people with family last names as family members
        const updateQuery = `
            UPDATE dbo.NameEvent
            SET IsFamilyMember = 1
            WHERE neType = 'N'
            AND (
                neName LIKE '% Morton' OR neName LIKE 'Morton %' OR neName = 'Morton'
                OR neName LIKE '% Moss' OR neName LIKE 'Moss %' OR neName = 'Moss'
                OR neName LIKE '% Kaplan' OR neName LIKE 'Kaplan %' OR neName = 'Kaplan'
                OR neName LIKE '% Hodges' OR neName LIKE 'Hodges %' OR neName = 'Hodges'
                OR neName LIKE '% Kaplan-Moss' OR neName LIKE 'Kaplan-Moss %' OR neName = 'Kaplan-Moss'
            )
        `;

        await execute(updateQuery);

        // Get counts
        const statsQuery = `
            SELECT 
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') as totalPeople,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N' AND IsFamilyMember = 1) as familyMembers,
                (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N' AND (IsFamilyMember = 0 OR IsFamilyMember IS NULL)) as nonFamilyMembers
        `;

        const stats = await query(statsQuery);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: true,
                message: 'Family members marked successfully',
                stats: stats[0]
            }
        };

    } catch (err) {
        context.log.error('Mark family members API error:', err);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: { error: 'Failed to mark family members', details: err.message }
        };
    }
};
