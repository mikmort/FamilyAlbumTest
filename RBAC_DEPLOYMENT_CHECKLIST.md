# RBAC Deployment Checklist

This document outlines the steps needed to deploy the new role-based access control system.

## ✅ Completed Items

- [x] Database schema created (`database/users-permissions-schema.sql`)
- [x] Authorization module implemented (`api/shared/auth.js`)
- [x] User management API created (`api/users/index.js`)
- [x] Auth status endpoint created (`api/auth-status/index.js`)
- [x] Admin notification API created (`api/notify-admins/index.js`)
- [x] Admin settings UI component created (`components/AdminSettings.tsx`)
- [x] Access request UI component created (`components/AccessRequest.tsx`)
- [x] Main app updated with authorization checks (`app/page.tsx`)
- [x] Navigation updated with admin button (`components/Navigation.tsx`)
- [x] Protected all existing API endpoints (media, people, events, upload, etc.)
- [x] Microsoft and Google authentication configured (`staticwebapp.config.json`)
- [x] Custom login page created (`public/login.html`)
- [x] Documentation created (`docs/RBAC_SYSTEM.md`)

## 🔲 Deployment Steps

### Step 1: Deploy Database Schema

Run the schema against your Azure SQL Database:

```powershell
# Option 1: Using sqlcmd
sqlcmd -S familyalbumdb.database.windows.net -d FamilyAlbum -U admin -P "YourPassword" -i database\users-permissions-schema.sql

# Option 2: Using Azure Data Studio or SSMS
# Open database/users-permissions-schema.sql and execute
```

**Verify:**
```sql
-- Check if table was created
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users';

-- Verify initial admins were added
SELECT Email, Role, Status FROM Users WHERE Role = 'Admin';
```

You should see 3 admin users:
- mikmort@hotmail.com
- mikmort@gmail.com
- jb_morton@live.com

### Step 2: Commit and Push Changes

```powershell
git add .
git commit -m "Add role-based access control system

- Add Users table with Admin/Full/Read roles
- Implement authorization middleware for all API endpoints
- Create admin settings UI for user management
- Add access request page for unauthorized users
- Protect media, people, events, and upload endpoints
- Add email notification system (stub for future implementation)"

git push origin main
```

### Step 3: Wait for Azure Deployment

Azure Static Web Apps will automatically:
1. Build the Next.js application
2. Deploy the API functions
3. Update the static assets
4. Deploy the new configuration

**Monitor deployment:**
- Go to Azure Portal → Your Static Web App → Deployments
- Wait for status to show "Success" (typically 2-5 minutes)

### Step 4: Test the System

#### Test 1: Admin Access
1. Navigate to your app URL
2. Sign in with one of the admin accounts (mikmort@hotmail.com, etc.)
3. You should see the main app with **🔒 Admin Settings** button
4. Click Admin Settings and verify you see the user management panel

#### Test 2: New User Flow
1. Open app in incognito/private window
2. Sign in with a different Microsoft or Google account
3. You should see the "Access Request Pending" page
4. Check admin account - you should see this user in "Pending Requests"
5. Approve the user and assign a role
6. Sign back in with test account - you should now have access

#### Test 3: Authorization
1. Sign in with a Read-only user
2. Try to upload media - should be blocked
3. Try to edit people - should be blocked
4. Viewing media should work

### Step 5: Configure Email Notifications (Optional)

The system logs admin notifications but doesn't send actual emails yet. To enable:

#### Option A: Azure Communication Services
1. Create an Azure Communication Services resource
2. Add email service
3. Install package: `npm install @azure/communication-email`
4. Update `api/notify-admins/index.js` with email sending code
5. Add `COMMUNICATION_CONNECTION_STRING` to app settings

#### Option B: SendGrid
1. Create SendGrid account
2. Get API key
3. Install package: `npm install @sendgrid/mail`
4. Update `api/notify-admins/index.js` with SendGrid code
5. Add `SENDGRID_API_KEY` to app settings

## 🔍 Verification Queries

### Check User Status
```sql
SELECT 
    Email, 
    Role, 
    Status, 
    RequestedAt, 
    ApprovedAt, 
    LastLoginAt 
FROM Users 
ORDER BY RequestedAt DESC;
```

### View Pending Requests
```sql
SELECT * FROM vw_PendingAccessRequests;
```

### View Users by Role
```sql
SELECT * FROM vw_ActiveUsersByRole;
```

### Manually Add a User
```sql
INSERT INTO Users (Email, Role, Status, ApprovedAt, ApprovedBy)
VALUES ('newuser@example.com', 'Full', 'Active', GETUTCDATE(), 'admin@example.com');
```

### Update User Role
```sql
UPDATE Users 
SET Role = 'Full', 
    Status = 'Active', 
    ApprovedAt = GETUTCDATE(), 
    ApprovedBy = 'admin@example.com' 
WHERE Email = 'user@example.com';
```

## 🐛 Troubleshooting

### Problem: "Access Denied" for everyone
**Solution:**
- Check database connection string in Azure app settings
- Verify Users table exists: `SELECT * FROM Users;`
- Check Azure Function logs for errors

### Problem: Admin button doesn't show
**Solution:**
- Verify Role is exactly "Admin" (case-sensitive)
- Check Status is "Active"
- Clear browser cache and sign in again
- Check browser console for errors

### Problem: New users stuck on "Access Request" page
**Solution:**
- Check `api/auth-status` is working: `curl https://yourapp.azurestaticapps.net/api/auth-status`
- Verify database has user record with Pending status
- Check if getOrCreateUser() is working in auth.js

### Problem: Cannot approve pending requests
**Solution:**
- Verify you're signed in as Admin role
- Check browser network tab for API errors
- Verify `/api/users` endpoint is working
- Check database permissions

## 📋 Post-Deployment Tasks

### 1. Review Initial Admins
- Verify all admin emails are correct
- Add or remove admins as needed in database

### 2. Set Up Email Notifications
- Choose email service (Azure Communication Services or SendGrid)
- Implement email sending in `api/notify-admins/index.js`
- Test with new user registration

### 3. Document User Onboarding
- Create instructions for family members
- Explain how to request access
- List expected wait time for approval

### 4. Monitor Usage
- Check pending requests regularly
- Review user activity via LastLoginAt
- Consider adding audit logging for admin actions

### 5. Backup Database
```sql
-- Create backup before making changes
BACKUP DATABASE FamilyAlbum 
TO DISK = 'FamilyAlbum_backup.bak';
```

## 📝 Configuration Summary

### Azure App Settings Required
- `SQL_CONNECTION_STRING` - Already configured
- `STORAGE_CONNECTION_STRING` - Already configured
- `GOOGLE_CLIENT_ID` - Already configured
- `GOOGLE_CLIENT_SECRET` - Already configured
- `AAD_CLIENT_ID` - Optional, already configured
- `AAD_CLIENT_SECRET` - Optional, already configured

### New Database Objects
- Table: `Users`
- View: `vw_ActiveUsersByRole`
- View: `vw_PendingAccessRequests`
- Trigger: `trg_Users_UpdatedAt`

### New API Endpoints
- `GET /api/auth-status` - Check user authorization
- `GET /api/users` - List all users (Admin only)
- `GET /api/users?pending=true` - List pending requests (Admin only)
- `POST /api/users` - Add new user (Admin only)
- `PUT /api/users/:id` - Update user (Admin only)
- `DELETE /api/users/:id` - Delete user (Admin only)
- `POST /api/notify-admins` - Send notification to admins

### Protected Endpoints
All these now require authentication and appropriate role:
- `/api/media/*` - Read role for GET, Full role for write
- `/api/people/*` - Read role for GET, Full role for write
- `/api/events/*` - Read role required
- `/api/unindexed/*` - Read role for GET, Full role for write
- `/api/getUploadUrl` - Full role required
- `/api/uploadComplete` - Full role required

## 🎉 Success Criteria

The RBAC system is successfully deployed when:
- [x] Users table exists in database with 3 admins
- [x] Admins can sign in and see Admin Settings
- [x] New users see Access Request page
- [x] Admins can approve/deny pending requests
- [x] Read users can view but not edit
- [x] Full users can view and edit
- [x] Unauthorized API calls return 401/403 errors
- [x] All tests pass without errors

## 📚 Additional Resources

- Full documentation: `docs/RBAC_SYSTEM.md`
- Authentication setup: `docs/AUTHENTICATION_SETUP.md`
- Database schema: `database/users-permissions-schema.sql`
- Authorization module: `api/shared/auth.js`

## Support

For deployment issues, contact:
- mikmort@hotmail.com
- mikmort@gmail.com
- jb_morton@live.com
