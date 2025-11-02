# Email Notification Setup Guide

This guide explains how to set up email notifications for user access requests in the Family Album application.

## Overview

When a new user authenticates but doesn't have access, the system:
1. Creates a user record with "Pending" status
2. Generates secure approval tokens
3. Sends email to all admin users with approval links
4. Admins can approve (with Full or Read-only access) or deny via email links

## Current Implementation Status

The email approval feature is **implemented and ready** but currently only **logs** the email content to the console. You need to integrate with an actual email service to send the emails.

### What's Already Working

✅ Token generation and storage in database  
✅ Approval endpoint (`/api/approve-access`) with confirmation UI  
✅ Token validation, expiration (7 days), and one-time use  
✅ User status updates (Active/Denied)  
✅ Anonymous access to approval links (no login required)  

### What Needs Configuration

🔧 Email service integration (Azure Communication Services, SendGrid, or similar)

## Email Service Options

### Option 1: Azure Communication Services (Recommended for Azure deployments)

**Cost**: ~$0.001 per email (very affordable for small-scale use)

1. **Create Email Communication Service**:
   ```bash
   # Via Azure Portal
   # Create Resource > Communication Services > Email Communication Service
   # Add a custom domain or use the free azurecomm.net domain
   ```

2. **Install SDK**:
   ```bash
   cd api
   npm install @azure/communication-email
   ```

3. **Add environment variable**:
   ```env
   AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://...;accesskey=...
   ```

4. **Update `api/notify-admins/index.js`**:
   ```javascript
   const { EmailClient } = require("@azure/communication-email");
   
   // After generating approval links, add:
   const emailClient = new EmailClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING);
   
   const emailMessage = {
       senderAddress: "DoNotReply@your-verified-domain.azurecomm.net",
       recipients: {
           to: admins.map(a => ({ address: a.Email }))
       },
       content: {
           subject: "New Access Request - Family Album",
           html: `
               <h2>New User Access Request</h2>
               <p><strong>User:</strong> ${userName || userEmail}</p>
               <p><strong>Email:</strong> ${userEmail}</p>
               <p><strong>Time:</strong> ${new Date().toISOString()}</p>
               
               <h3>Action Required</h3>
               <p>Click one of the following links to approve or deny access:</p>
               
               <p>
                   <a href="${fullAccessUrl}" style="background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
                       ✅ Approve (Full Access)
                   </a>
               </p>
               <p>
                   <a href="${readOnlyUrl}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
                       📖 Approve (Read Only)
                   </a>
               </p>
               <p>
                   <a href="${denyUrl}" style="background: #dc3545; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 5px;">
                       ❌ Deny Access
                   </a>
               </p>
               
               <p style="color: #666; font-size: 12px;">These links will expire on ${expiresAt.toLocaleString()}</p>
           `
       }
   };
   
   const poller = await emailClient.beginSend(emailMessage);
   await poller.pollUntilDone();
   ```

### Option 2: SendGrid

**Cost**: Free tier includes 100 emails/day

1. **Sign up at SendGrid**: https://sendgrid.com/

2. **Install SDK**:
   ```bash
   cd api
   npm install @sendgrid/mail
   ```

3. **Add environment variable**:
   ```env
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   ```

4. **Update `api/notify-admins/index.js`**:
   ```javascript
   const sgMail = require('@sendgrid/mail');
   sgMail.setApiKey(process.env.SENDGRID_API_KEY);
   
   // After generating approval links, add:
   const msg = {
       to: admins.map(a => a.Email),
       from: 'noreply@your-verified-domain.com',
       subject: 'New Access Request - Family Album',
       html: `
           <h2>New User Access Request</h2>
           <p><strong>User:</strong> ${userName || userEmail}</p>
           <p><strong>Email:</strong> ${userEmail}</p>
           
           <h3>Action Required</h3>
           <p><a href="${fullAccessUrl}">✅ Approve (Full Access)</a></p>
           <p><a href="${readOnlyUrl}">📖 Approve (Read Only)</a></p>
           <p><a href="${denyUrl}">❌ Deny Access</a></p>
       `
   };
   
   await sgMail.send(msg);
   ```

### Option 3: Other Email Services

Similar integration patterns work for:
- **Mailgun**: npm install `mailgun-js`
- **Postmark**: npm install `postmark`
- **AWS SES**: npm install `@aws-sdk/client-ses`

## Database Setup

Before using the feature, apply the database schema:

```sql
-- Run this SQL script on your Azure SQL Database:
-- database/approval-tokens-schema.sql
```

Or via PowerShell:
```powershell
.\scripts\setup-database.ps1 -SchemaFile "database\approval-tokens-schema.sql"
```

## Testing

### 1. Test Without Email Service

The feature works without email integration - it will log the approval URLs:

1. Sign in as a new user
2. Check Azure Function logs for approval URLs
3. Copy and test the URLs manually
4. Verify user status changes in database

### 2. Test With Email Service

After integrating an email service:

1. Create a test admin user in the database
2. Sign in as a new user
3. Check admin email for approval links
4. Click an approval link
5. Confirm the action on the web page
6. Verify user status is updated

## Security Considerations

✅ **Implemented**:
- Tokens are cryptographically secure (32 bytes, hex-encoded)
- Tokens expire after 7 days
- Tokens can only be used once
- Token validation on server-side
- Anonymous access to approval endpoint (no auth required for email links)

⚠️ **Additional Recommendations**:
- Use HTTPS (automatic with Azure Static Web Apps)
- Consider adding rate limiting to approval endpoint
- Monitor failed approval attempts
- Regularly clean up old tokens (handled by DB trigger)

## Troubleshooting

### Issue: Approval links return 404
**Solution**: Ensure database schema is applied and ApprovalTokens table exists

### Issue: Emails not sent
**Solution**: 
- Check environment variables are set
- Verify email service credentials
- Check Azure Function logs for errors
- Ensure sender domain is verified (for custom domains)

### Issue: Token expired or already used
**Solution**: 
- Tokens expire after 7 days
- Generate new approval by having user sign in again
- Or manually create tokens via direct database access (for testing)

## Cost Estimation

For a family application with ~5-10 new users per year:

- **Azure Communication Services**: ~$0.05-0.10/year
- **SendGrid Free Tier**: $0/year (100 emails/day limit)
- **Database storage**: Negligible (~1KB per token)

## Support

For issues or questions:
- Check Azure Function logs in Azure Portal
- Review database ApprovalTokens table
- Test approval URLs manually in browser
