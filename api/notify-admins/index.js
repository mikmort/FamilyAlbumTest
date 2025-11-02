const { query } = require('../shared/db');
const crypto = require('crypto');

// Generate a secure random token
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

// Get the base URL for approval links
function getBaseUrl(context) {
    // Try to get the host from headers
    const host = context.req.headers['x-forwarded-host'] || context.req.headers['host'];
    const proto = context.req.headers['x-forwarded-proto'] || 'https';
    
    if (host) {
        return `${proto}://${host}`;
    }
    
    // Fallback to environment variable (required if headers not available)
    if (!process.env.SITE_URL) {
        throw new Error('SITE_URL environment variable must be set for approval links');
    }
    return process.env.SITE_URL;
}

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

        // Get the user ID
        const userResult = await query(`
            SELECT ID 
            FROM dbo.Users 
            WHERE Email = @email
        `, { email: userEmail.toLowerCase() });

        if (userResult.length === 0) {
            context.res = {
                status: 404,
                headers: { 'Content-Type': 'application/json' },
                body: { 
                    success: false,
                    error: 'User not found' 
                }
            };
            return;
        }

        const userId = userResult[0].ID;

        // Generate approval tokens (valid for 7 days)
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const fullAccessToken = generateToken();
        const readOnlyToken = generateToken();
        const denyToken = generateToken();

        // Store tokens in database
        await query(`
            INSERT INTO dbo.ApprovalTokens (Token, UserID, Action, ExpiresAt)
            VALUES 
                (@fullAccessToken, @userId, 'FullAccess', @expiresAt),
                (@readOnlyToken, @userId, 'ReadOnly', @expiresAt),
                (@denyToken, @userId, 'Deny', @expiresAt)
        `, {
            fullAccessToken,
            readOnlyToken,
            denyToken,
            userId,
            expiresAt
        });

        const baseUrl = getBaseUrl(context);
        const fullAccessUrl = `${baseUrl}/api/approve-access?token=${fullAccessToken}`;
        const readOnlyUrl = `${baseUrl}/api/approve-access?token=${readOnlyToken}`;
        const denyUrl = `${baseUrl}/api/approve-access?token=${denyToken}`;

        const adminEmails = admins.map(a => a.Email).join(', ');
        
        // TODO: Implement actual email sending using Azure Communication Services, SendGrid, or similar
        // For now, log the email content with the approval links
        context.log(`📧 Would send email notification to: ${adminEmails}`);
        context.log(`Subject: New Access Request - Family Album`);
        context.log(`\nBody:\n`);
        context.log(`A new user is requesting access to the Family Album:`);
        context.log(`  User: ${userName || userEmail}`);
        context.log(`  Email: ${userEmail}`);
        context.log(`  Message: ${message || 'No message provided'}`);
        context.log(`  Time: ${new Date().toISOString()}`);
        context.log(`\nPlease click one of the following links to approve or deny access:\n`);
        context.log(`✅ Approve (Full Access): ${fullAccessUrl}`);
        context.log(`📖 Approve (Read Only): ${readOnlyUrl}`);
        context.log(`❌ Deny Access: ${denyUrl}`);
        context.log(`\nThese links will expire on: ${expiresAt.toISOString()}`);

        // Here you would integrate with your email service:
        // 
        // Example with Azure Communication Services:
        // const { EmailClient } = require("@azure/communication-email");
        // const client = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);
        // await client.send({
        //     from: "noreply@your-domain.com",
        //     to: admins.map(a => ({ email: a.Email })),
        //     subject: "New Access Request - Family Album",
        //     html: generateEmailHtml(...)
        // });

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: true,
                message: 'Admin notification sent (logged)',
                admins: admins.map(a => a.Email),
                approvalLinks: {
                    fullAccess: fullAccessUrl,
                    readOnly: readOnlyUrl,
                    deny: denyUrl
                }
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
