# Role-Based Access Control (RBAC) System

## Overview

The Family Album application now includes a comprehensive role-based access control system with three permission levels: **Admin**, **Full**, and **Read**. Users must authenticate via Microsoft or Google accounts and be granted appropriate permissions by an administrator.

## User Roles

### Admin
- **Full application access**: View, upload, edit, and delete media
- **User management**: Grant or revoke permissions for other users
- **Administrative functions**: Access admin settings, manage pending access requests
- **Initial admins**: mikmort@hotmail.com, mikmort@gmail.com, jb_morton@live.com

### Full
- **View media**: Browse and search the family album
- **Upload media**: Add new photos and videos
- **Edit metadata**: Tag people, create events, manage descriptions
- **Cannot**: Manage other users' permissions

### Read
- **View only**: Browse and search the family album
- **Cannot**: Upload, edit, delete, or manage permissions

## User Status States

### Active
User has been approved and can access the application according to their role.

### Pending
User has authenticated but awaits administrator approval. They see a friendly waiting message and administrators are notified.

### Denied
Access request has been denied by an administrator. User sees a message to contact admins if they believe this is an error.

### Suspended
Previously active user has been temporarily suspended. Contact an administrator to reactivate.

## User Journey

### First-Time User
1. Navigate to the application
2. Click sign-in (Microsoft or Google)
3. Successfully authenticate with identity provider
4. System automatically creates user record with **Pending** status
5. User sees access request page with estimated wait time
6. System notifies all administrators via email (future: when email is configured)
7. Administrator reviews request in Admin Settings
8. Administrator approves request and assigns role (Admin/Full/Read)
9. User can now access the application

### Returning User
1. Sign in with same account
2. System checks authorization status
3. If **Active**: Proceeds to application
4. If **Pending**: Shows waiting message
5. If **Denied/Suspended**: Shows appropriate message with contact info

## Database Schema

### Users Table
```sql
CREATE TABLE Users (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Email NVARCHAR(255) NOT NULL UNIQUE,
    Role NVARCHAR(50) NOT NULL CHECK (Role IN ('Admin', 'Full', 'Read')),
    Status NVARCHAR(50) NOT NULL CHECK (Status IN ('Active', 'Pending', 'Denied', 'Suspended')),
    RequestedAt DATETIME2 DEFAULT GETUTCDATE(),
    ApprovedAt DATETIME2,
    ApprovedBy NVARCHAR(255),
    LastLoginAt DATETIME2,
    Notes NVARCHAR(MAX),
    CreatedAt DATETIME2 DEFAULT GETUTCDATE(),
    UpdatedAt DATETIME2 DEFAULT GETUTCDATE()
);
```

## API Endpoints

### Authorization Endpoints

#### `GET /api/auth-status`
Check current user's authentication and authorization status.

**Response:**
```json
{
  "authenticated": true,
  "authorized": true,
  "user": {
    "email": "user@example.com",
    "name": "User Name",
    "role": "Full",
    "status": "Active"
  },
  "error": null
}
```

#### `GET /api/users`
List all users (Admin only).

**Query Parameters:**
- `pending=true` - Only show pending access requests

**Response:**
```json
{
  "success": true,
  "users": [
    {
      "ID": 1,
      "Email": "admin@example.com",
      "Role": "Admin",
      "Status": "Active",
      "RequestedAt": "2025-06-01T10:00:00Z",
      "ApprovedAt": "2025-06-01T10:05:00Z",
      "ApprovedBy": "admin@example.com",
      "LastLoginAt": "2025-06-15T14:30:00Z",
      "Notes": null,
      "CreatedAt": "2025-06-01T10:00:00Z",
      "UpdatedAt": "2025-06-01T10:05:00Z"
    }
  ]
}
```

#### `POST /api/users`
Add a new user (Admin only).

**Request:**
```json
{
  "email": "newuser@example.com",
  "role": "Read",
  "status": "Active",
  "notes": "Family friend"
}
```

#### `PUT /api/users/:id`
Update user role or status (Admin only).

**Request:**
```json
{
  "role": "Full",
  "status": "Active",
  "notes": "Approved access"
}
```

#### `DELETE /api/users/:id`
Remove a user (Admin only).

### Protected Endpoints

All media, people, events, and upload endpoints now require authentication and appropriate permissions:

| Endpoint | GET (Read) | POST/PUT/DELETE (Write) |
|----------|-----------|------------------------|
| `/api/media/*` | Read role | Full role |
| `/api/people/*` | Read role | Full role |
| `/api/events/*` | Read role | Full role |
| `/api/unindexed/*` | Read role | Full role |
| `/api/getUploadUrl` | N/A | Full role |
| `/api/uploadComplete` | N/A | Full role |

## Admin Features

### Admin Settings Page

Administrators access this page via the **🔒 Admin Settings** button in the navigation bar.

#### Pending Access Requests
- See all users with Pending status
- View email, name, request date
- Approve or deny with one click
- Optionally add notes when approving/denying

#### User Management
- View all users in a table
- Inline edit role and status
- Add new users manually
- Delete users
- View approval history and last login

#### Features
- **Search**: Filter users by email or name
- **Color-coded badges**: 
  - Roles: Admin (red), Full (blue), Read (green)
  - Status: Active (green), Pending (yellow), Denied (red), Suspended (gray)
- **Permissions legend**: Shows what each role can do

## Frontend Components

### AccessRequest.tsx
Displays status-appropriate messages for unauthorized users:
- Not signed in: Sign-in button
- Pending: Friendly waiting message with next steps
- Denied: Contact information for appeal
- Suspended: Administrator contact info

### AdminSettings.tsx
Full-featured admin panel for user management:
- Pending requests section
- Add new user form
- User list table with inline editing
- Confirmation dialogs for deletions

## Authorization Module

### `api/shared/auth.js`

Core authorization functions used across all API endpoints:

#### `checkAuthorization(context, requiredRole)`
Main middleware function that:
1. Extracts user info from Azure Static Web Apps headers
2. Gets or creates user record in database
3. Updates last login timestamp
4. Checks if user has required permission level
5. Returns authorization result with status and message

**Usage:**
```javascript
const { checkAuthorization } = require('../shared/auth');

module.exports = async function (context, req) {
  const authResult = await checkAuthorization(context, 'Read');
  if (!authResult.authorized) {
    context.res = {
      status: authResult.status,
      body: { error: authResult.message }
    };
    return;
  }
  // Continue with authorized logic...
};
```

#### Role Hierarchy
```javascript
const ROLE_HIERARCHY = {
  'Admin': 3,
  'Full': 2,
  'Read': 1,
  'None': 0
};
```

Admin role can access everything Full and Read can access. Full role can access everything Read can access.

## Setup Instructions

### 1. Database Setup

Run the database schema to create the Users table:

```powershell
cd c:\Users\mikmo\Documents\code\FamilyAlbumTest
sqlcmd -S your-server.database.windows.net -d FamilyAlbum -U admin -P password -i database\users-permissions-schema.sql
```

This creates:
- `Users` table with all necessary columns and constraints
- Indexes on Email and Status
- Triggers for UpdatedAt timestamp
- Views: `vw_ActiveUsersByRole`, `vw_PendingAccessRequests`
- Initial admin users (mikmort@hotmail.com, mikmort@gmail.com, jb_morton@live.com)

### 2. Verify Authentication Configuration

Authentication providers are already configured in `staticwebapp.config.json`:

```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/common/v2.0",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      },
      "google": {
        "registration": {
          "clientIdSettingName": "GOOGLE_CLIENT_ID",
          "clientSecretSettingName": "GOOGLE_CLIENT_SECRET"
        }
      }
    }
  }
}
```

### 3. Configure App Settings in Azure Portal

Add these application settings to your Azure Static Web App:

- `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret
- `AAD_CLIENT_ID` - (Optional) Azure AD app registration client ID
- `AAD_CLIENT_SECRET` - (Optional) Azure AD app registration client secret

### 4. Test the System

1. **Sign out** and navigate to the app
2. Click **Sign In** and authenticate with Microsoft or Google
3. You should see the **Access Request** page (unless you're one of the pre-configured admins)
4. Sign in as an admin account
5. Click **🔒 Admin Settings**
6. Find your test user in Pending Requests
7. Click **Approve** and assign a role
8. Sign back in with test account - you should now have access

## Security Considerations

### Email Normalization
All email addresses are stored in lowercase for consistent matching:
```javascript
const email = userEmail.toLowerCase();
```

### SQL Injection Prevention
All database queries use parameterized queries:
```javascript
await query('SELECT * FROM Users WHERE Email = @email', { email });
```

### Authorization Headers
User identity comes from Azure Static Web Apps built-in authentication:
- Header: `x-ms-client-principal` (base64 encoded JSON)
- Contains: userId, userRoles, claims (including email)

### Session Management
- Managed by Azure Static Web Apps
- Users stay signed in across browser sessions
- Sign out clears session and redirects to login page

## Future Enhancements

### Email Notifications (TODO)
The `api/notify-admins` endpoint is implemented but currently only logs notifications. To enable actual email sending:

1. **Azure Communication Services** (Recommended)
   ```bash
   npm install @azure/communication-email
   ```

2. **SendGrid**
   ```bash
   npm install @sendgrid/mail
   ```

3. Update `api/notify-admins/index.js` with actual email sending logic

### Audit Logging
Consider adding an `AuditLog` table to track:
- Permission changes
- User approvals/denials
- Admin actions
- Failed authorization attempts

### Access Request Forms
Add ability for users to provide:
- Relationship to family
- Reason for access
- Contact information

### Bulk Operations
- Approve multiple pending requests at once
- Export user list to CSV
- Import users from CSV

### Advanced Features
- Role expiration dates
- IP-based restrictions
- Two-factor authentication
- Activity monitoring dashboard

## Troubleshooting

### User Cannot Sign In
- Check if user is in Pending/Denied/Suspended status
- Verify authentication providers are configured correctly
- Check browser console for errors

### Admin Cannot See Admin Settings
- Verify user's role is exactly "Admin" (case-sensitive) in database
- Check that Status is "Active"
- Clear browser cache and sign in again

### Authorization Always Fails
- Check database connection in `api/shared/db.js`
- Verify Users table exists and has correct schema
- Check Azure Function logs for errors
- Ensure `x-ms-client-principal` header is present

### Permissions Not Working
- Verify all API endpoints have `checkAuthorization()` calls
- Check role hierarchy in `api/shared/auth.js`
- Test with database query: `SELECT * FROM Users WHERE Email = 'your@email.com'`

## Related Files

### Database
- `database/users-permissions-schema.sql` - Complete database schema with initial data

### API
- `api/shared/auth.js` - Authorization utilities and user management
- `api/users/index.js` - User CRUD API (Admin only)
- `api/auth-status/index.js` - Check current user status
- `api/notify-admins/index.js` - Email notification system (stub)

### Components
- `components/AccessRequest.tsx` - Unauthorized user experience
- `components/AdminSettings.tsx` - Admin user management panel
- `components/Navigation.tsx` - Updated with admin button

### Documentation
- `docs/AUTHENTICATION_SETUP.md` - Authentication provider configuration
- `docs/RBAC_SYSTEM.md` - This document

## Support

For questions or issues with the RBAC system, contact the initial administrators:
- mikmort@hotmail.com
- mikmort@gmail.com
- jb_morton@live.com
