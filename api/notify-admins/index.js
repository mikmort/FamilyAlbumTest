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

// Generate HTML email content
function generateEmailHtml(userEmail, userName, message, fullAccessUrl, readOnlyUrl, denyUrl, expiresAt) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Access Request - Family Album</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
        <h1 style="margin: 0; font-size: 28px;">🔔 New Access Request</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Family Album</p>
    </div>
    
    <div style="background: white; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; padding: 30px;">
        <p style="font-size: 16px; margin-top: 0;">A new user is requesting access to the Family Album:</p>
        
        <div style="background: #f8f9fa; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 5px 0;"><strong>Name:</strong> ${userName || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${userEmail}</p>
            <p style="margin: 5px 0;"><strong>Message:</strong> ${message || 'No message provided'}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        
        <h2 style="color: #333; font-size: 20px; margin-top: 30px;">Action Required</h2>
        <p>Please click one of the following buttons to approve or deny access:</p>
        
        <table style="width: 100%; margin: 20px 0;" cellpadding="10" cellspacing="0">
            <tr>
                <td align="center">
                    <a href="${fullAccessUrl}" style="display: inline-block; background: #28a745; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        ✅ Approve (Full Access)
                    </a>
                </td>
            </tr>
            <tr>
                <td align="center">
                    <a href="${readOnlyUrl}" style="display: inline-block; background: #007bff; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        📖 Approve (Read Only)
                    </a>
                </td>
            </tr>
            <tr>
                <td align="center">
                    <a href="${denyUrl}" style="display: inline-block; background: #dc3545; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                        ❌ Deny Access
                    </a>
                </td>
            </tr>
        </table>
        
        <div style="background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
                <strong>⏰ Note:</strong> These approval links will expire on <strong>${new Date(expiresAt).toLocaleString()}</strong>
            </p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; font-size: 12px; color: #666; text-align: center;">
            <p style="margin: 5px 0;">This is an automated message from Family Album.</p>
            <p style="margin: 5px 0;">If you did not expect this email, please ignore it.</p>
        </div>
    </div>
</body>
</html>
    `.trim();
}

// Send email using configured service
async function sendEmail(context, adminEmails, userEmail, userName, message, fullAccessUrl, readOnlyUrl, denyUrl, expiresAt) {
    const fromAddress = process.env.EMAIL_FROM_ADDRESS;
    const subject = 'New Access Request - Family Album';
    const html = generateEmailHtml(userEmail, userName, message, fullAccessUrl, readOnlyUrl, denyUrl, expiresAt);
    
    // Check if Azure Communication Services is configured
    if (process.env.AZURE_COMMUNICATION_CONNECTION_STRING && fromAddress) {
        try {
            // Dynamically require the package - it's optional
            const { EmailClient } = require('@azure/communication-email');
            const emailClient = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);
            
            const emailMessage = {
                senderAddress: fromAddress,
                recipients: {
                    to: adminEmails.map(email => ({ address: email }))
                },
                content: {
                    subject: subject,
                    html: html
                }
            };
            
            context.log('Sending email via Azure Communication Services...');
            const poller = await emailClient.beginSend(emailMessage);
            await poller.pollUntilDone();
            context.log('✅ Email sent successfully via Azure Communication Services');
            return { success: true, method: 'Azure Communication Services' };
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                context.log.error('Azure Communication Services package not installed. Run: npm install @azure/communication-email');
                return { success: false, method: 'none', error: 'Package not installed' };
            }
            context.log.error('Failed to send email via Azure Communication Services:', error);
            throw error;
        }
    }
    
    // Check if SendGrid is configured
    if (process.env.SENDGRID_API_KEY && fromAddress) {
        try {
            // Dynamically require the package - it's optional
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);
            
            const msg = {
                to: adminEmails,
                from: fromAddress,
                subject: subject,
                html: html
            };
            
            context.log('Sending email via SendGrid...');
            await sgMail.send(msg);
            context.log('✅ Email sent successfully via SendGrid');
            return { success: true, method: 'SendGrid' };
        } catch (error) {
            if (error.code === 'MODULE_NOT_FOUND') {
                context.log.error('SendGrid package not installed. Run: npm install @sendgrid/mail');
                return { success: false, method: 'none', error: 'Package not installed' };
            }
            context.log.error('Failed to send email via SendGrid:', error);
            throw error;
        }
    }
    
    // No email service configured - log to console
    context.log.warn('⚠️ No email service configured. Email not sent.');
    context.log.warn('To enable email notifications, configure one of:');
    context.log.warn('  - AZURE_COMMUNICATION_CONNECTION_STRING + EMAIL_FROM_ADDRESS (for Azure Communication Services)');
    context.log.warn('  - SENDGRID_API_KEY + EMAIL_FROM_ADDRESS (for SendGrid)');
    return { success: false, method: 'none' };
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

        const adminEmailsList = admins.map(a => a.Email);
        
        // Log the email content for debugging
        context.log(`📧 Notifying ${adminEmailsList.length} admin(s): ${adminEmailsList.join(', ')}`);
        context.log(`Subject: New Access Request - Family Album`);
        context.log(`User: ${userName || userEmail} (${userEmail})`);
        context.log(`Approval links generated:`);
        context.log(`  ✅ Full Access: ${fullAccessUrl}`);
        context.log(`  📖 Read Only: ${readOnlyUrl}`);
        context.log(`  ❌ Deny: ${denyUrl}`);
        context.log(`Links expire: ${expiresAt.toISOString()}`);

        // Attempt to send email via configured service
        let emailResult;
        try {
            emailResult = await sendEmail(
                context, 
                adminEmailsList, 
                userEmail, 
                userName, 
                message, 
                fullAccessUrl, 
                readOnlyUrl, 
                denyUrl, 
                expiresAt
            );
        } catch (emailError) {
            // Log error but don't fail the request - tokens are still created
            context.log.error('Email sending failed, but tokens were created:', emailError);
            emailResult = { success: false, method: 'error', error: emailError.message };
        }

        context.res = {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: {
                success: true,
                message: emailResult.success 
                    ? `Admin notification sent via ${emailResult.method}` 
                    : 'Tokens created (email not sent - see logs)',
                admins: adminEmailsList,
                emailSent: emailResult.success,
                emailMethod: emailResult.method,
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
