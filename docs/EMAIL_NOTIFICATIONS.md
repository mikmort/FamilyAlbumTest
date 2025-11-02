# Email Notifications Setup

This document explains how to configure email notifications for admin approval of new user access requests.

## Overview

When a new user authenticates with the Family Album application but doesn't have access:
1. The system creates a user record with "Pending" status
2. Approval tokens are generated and stored in the database
3. **If email is configured**: Admins receive an email with approval/deny links
4. **If email is not configured**: Approval URLs are logged to the console (tokens still work)

## Quick Start

Email notifications are **optional** but recommended. The system works without email - you can:
- Check Azure Function logs for approval URLs
- Use the Admin Settings page in the app to approve/deny users
- Copy approval URLs from logs and share them manually

## Enabling Email Notifications

To enable automatic email notifications, configure ONE of the following email services:

### Option 1: Azure Communication Services (Recommended)

**Best for**: Azure-hosted applications, integrated Azure billing

**Cost**: ~$0.001 per email (very affordable)

**Setup Steps**:

1. **Create Azure Communication Service**:
   - Go to Azure Portal
   - Create Resource → Communication Services
   - Create an Email Communication Service resource
   - Get the connection string from "Keys" section

2. **Configure Domain**:
   - Use the free `*.azurecomm.net` domain (instant), OR
   - Add and verify your custom domain

3. **Install Package** (if not already installed):
   ```bash
   cd api
   npm install @azure/communication-email
   ```

4. **Set Environment Variables**:
   
   In Azure Static Web App Configuration:
   ```
   AZURE_COMMUNICATION_CONNECTION_STRING=endpoint=https://...;accesskey=...
   EMAIL_FROM_ADDRESS=DoNotReply@your-subdomain.azurecomm.net
   ```

### Option 2: SendGrid

**Best for**: Multi-cloud or non-Azure deployments

**Cost**: Free tier includes 100 emails/day (more than enough for family use)

**Setup Steps**:

1. **Sign up**: https://sendgrid.com/

2. **Create API Key**:
   - Go to Settings → API Keys
   - Create API Key with "Mail Send" permission
   - Copy the key (shown only once)

3. **Verify Sender**:
   - Go to Settings → Sender Authentication
   - Verify your email address or domain

4. **Install Package** (if not already installed):
   ```bash
   cd api
   npm install @sendgrid/mail
   ```

5. **Set Environment Variables**:
   
   In Azure Static Web App Configuration:
   ```
   SENDGRID_API_KEY=SG.xxxxxxxxxxxxx
   EMAIL_FROM_ADDRESS=noreply@your-verified-domain.com
   ```

## Environment Variables

### Required for Email Notifications

| Variable | Description | Example |
|----------|-------------|---------|
| `EMAIL_FROM_ADDRESS` | Sender email address | `noreply@example.com` |
| `AZURE_COMMUNICATION_CONNECTION_STRING` | Azure Comm Services connection string (if using Azure) | `endpoint=https://...;accesskey=...` |
| `SENDGRID_API_KEY` | SendGrid API key (if using SendGrid) | `SG.xxxxxxxxxxxxx` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `SITE_URL` | Base URL for approval links | Auto-detected from request headers |

## Setting Environment Variables

### In Azure Static Web Apps:

1. Go to Azure Portal
2. Navigate to your Static Web App
3. Go to Settings → Configuration
4. Click "Application settings"
5. Add the required environment variables
6. Click "Save"
7. The app will automatically restart

### For Local Development:

Add to your `.env.local` file (copy from `.env.local.template`):

```env
# For Azure Communication Services
AZURE_COMMUNICATION_CONNECTION_STRING=your-connection-string
EMAIL_FROM_ADDRESS=DoNotReply@your-domain.azurecomm.net

# OR for SendGrid
SENDGRID_API_KEY=your-api-key
EMAIL_FROM_ADDRESS=noreply@your-domain.com
```

## Testing

### 1. Test Without Email Configuration

The approval feature works without email:

1. Sign in as a new user (or create a test user with Pending status)
2. Check Azure Function logs:
   - Azure Portal → Function App → Monitor → Logs
   - Look for "Notifying admin(s)" messages
3. Copy the approval URLs from the logs
4. Open an approval URL in a browser
5. Confirm the action
6. Verify the user status changed in the database

### 2. Test With Email Configuration

After configuring email:

1. Ensure you have an admin user in the database
2. Sign in as a new user
3. Check the admin's email inbox
4. Click one of the approval buttons in the email
5. Confirm the action on the web page
6. Verify the user can now access the app

### 3. Check Logs

To verify email is working:

```
Azure Portal → Function App → Monitor → Logs
```

Look for:
- `✅ Email sent successfully via [service name]` (success)
- `⚠️ No email service configured` (not configured)
- `Failed to send email via [service]` (configuration error)

## Troubleshooting

### Email Not Sending

**Check the following**:

1. **Environment variables set correctly?**
   - Go to Azure Portal → Static Web App → Configuration
   - Verify `EMAIL_FROM_ADDRESS` and email service credentials are set

2. **Package installed?**
   - Azure: Packages should install automatically from `package.json`
   - Local: Run `cd api && npm install`

3. **Sender domain verified?** (for SendGrid/custom domains)
   - SendGrid: Settings → Sender Authentication
   - Azure: Email Communication Service → Domains

4. **Check Azure Function logs**
   - Azure Portal → Function App → Monitor
   - Look for error messages

### Common Errors

**"Module not found: @azure/communication-email"**
- Solution: The package is optional. Either install it or use SendGrid instead.

**"Sender address not verified"** (SendGrid)
- Solution: Verify your email address or domain in SendGrid settings

**"Invalid connection string"** (Azure)
- Solution: Copy the full connection string from Azure Portal, ensure no extra spaces

**"No email service configured"**
- Solution: This is just a warning. Either configure email or use approval URLs from logs.

## Cost Estimation

For a typical family application (5-10 new users per year):

| Service | Cost per Email | Annual Cost |
|---------|----------------|-------------|
| Azure Communication Services | $0.001 | $0.01 - $0.10 |
| SendGrid (Free Tier) | $0 | $0 |
| Database Storage | Negligible | < $0.01 |

**Total**: Less than $0.10/year

## Security Notes

✅ **Implemented Security Features**:
- Tokens are cryptographically secure (256-bit entropy)
- Tokens expire after 7 days
- Tokens can only be used once
- All token validation happens server-side
- Email links work without requiring admin to log in
- SQL injection prevention via parameterized queries

⚠️ **Best Practices**:
- Use HTTPS (automatic with Azure Static Web Apps)
- Never share your API keys or connection strings
- Regularly monitor approval activity
- Consider SPF/DKIM/DMARC records for custom domains

## Support

For additional help:
- Check the detailed setup guide: `docs/EMAIL_SETUP.md`
- Review email approval feature: `docs/EMAIL_APPROVAL_FEATURE.md`
- Test guidance: `docs/EMAIL_APPROVAL_TESTING.md`

## Alternative: Manual Approval

If you prefer not to configure email, you can still approve users:

1. **Via Admin Settings Page**:
   - Log in as an admin
   - Go to Admin Settings
   - Approve or deny pending requests

2. **Via Console Logs**:
   - Check Azure Function logs for approval URLs
   - Copy and open URLs in browser
   - Confirm the action

Both methods work perfectly fine for small family applications.
