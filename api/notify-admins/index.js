const { query } = require('../shared/db');

module.exports = async function (context, req) {
    context.log('Notify admins API called');

    try {
        const { userEmail, userName, message } = req.body;

        if (!userEmail) {
            context.res = {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    success: false,
                    error: 'userEmail is required' 
                }
            };
            return;
        }

        // Get all admin users
        const admins = await query(`
            SELECT Email 
            FROM dbo.Users 
            WHERE Role = 'Admin' AND Status = 'Active'
        `);

        if (admins.length === 0) {
            context.log.warn('No active admins found to notify');
            context.res = {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    success: true,
                    message: 'No admins to notify'
                }
            };
            return;
        }

        const adminEmails = admins.map(a => a.Email).join(', ');
        
        // TODO: Implement actual email sending using Azure Communication Services, SendGrid, or similar
        // For now, just log it
        context.log(`📧 Would send email notification to: ${adminEmails}`);
        context.log(`Subject: New Access Request - Family Album`);
        context.log(`Body:`);
        context.log(`  User: ${userName || userEmail}`);
        context.log(`  Email: ${userEmail}`);
        context.log(`  Message: ${message || 'No message provided'}`);
        context.log(`  Time: ${new Date().toISOString()}`);

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: true,
                message: 'Admin notification logged',
                admins: admins.map(a => a.Email)
            }
        };

    } catch (error) {
        context.log.error('Error notifying admins:', error);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: false,
                error: error.message
            }
        };
    }
};
