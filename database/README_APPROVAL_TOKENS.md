# Approval Tokens Database Schema

## Overview

This schema adds support for email-based user approval via secure token links. When a new user requests access, admins receive emails with approval/deny links that contain secure tokens.

## New Table: ApprovalTokens

```sql
CREATE TABLE dbo.ApprovalTokens (
    ID INT IDENTITY(1,1) PRIMARY KEY,
    Token NVARCHAR(255) NOT NULL UNIQUE,
    UserID INT NOT NULL,
    Action NVARCHAR(50) NOT NULL CHECK (Action IN ('FullAccess', 'ReadOnly', 'Deny')),
    CreatedAt DATETIME2 DEFAULT GETDATE(),
    ExpiresAt DATETIME2 NOT NULL,
    UsedAt DATETIME2 NULL,
    UsedBy NVARCHAR(255) NULL,
    
    FOREIGN KEY (UserID) REFERENCES dbo.Users(ID) ON DELETE CASCADE
);
```

## Fields

- **ID**: Auto-incrementing primary key
- **Token**: Unique 64-character hex string (cryptographically secure)
- **UserID**: Foreign key to Users table
- **Action**: Type of approval action ('FullAccess', 'ReadOnly', or 'Deny')
- **CreatedAt**: When the token was generated
- **ExpiresAt**: When the token expires (default: 7 days from creation)
- **UsedAt**: When the token was used (NULL if unused)
- **UsedBy**: Email of admin who used the token (or 'System')

## How It Works

### 1. Token Generation (api/notify-admins)

When a user with "Pending" status signs in:
```javascript
// Three tokens are generated per user request
FullAccessToken -> Approves with Full role
ReadOnlyToken   -> Approves with Read role
DenyToken       -> Denies access
```

### 2. Token Usage (api/approve-access)

When an admin clicks an approval link:
1. Token is validated (exists, not expired, not used)
2. Confirmation page is shown
3. Admin confirms action
4. User status/role is updated
5. Token is marked as used

### 3. Security Features

✅ Tokens are cryptographically secure (32 random bytes)  
✅ Tokens expire after 7 days  
✅ Tokens can only be used once  
✅ Old tokens are automatically cleaned up  
✅ Foreign key cascade deletes tokens when user is deleted  

## Installation

### Option 1: SQL Script

Run the schema file directly:
```sql
-- In Azure SQL Database query editor:
USE FamilyAlbum;
GO

-- Run the contents of approval-tokens-schema.sql
```

### Option 2: PowerShell Script

If you have the deployment scripts:
```powershell
.\scripts\run-sql-script.ps1 -ScriptPath "database\approval-tokens-schema.sql"
```

### Option 3: Manual via Azure Portal

1. Go to Azure Portal > Your SQL Database
2. Open Query Editor
3. Copy and paste contents of `approval-tokens-schema.sql`
4. Click "Run"

## Verification

After applying the schema, verify the table exists:

```sql
-- Check if table exists
SELECT * FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_NAME = 'ApprovalTokens';

-- Check table structure
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE,
    CHARACTER_MAXIMUM_LENGTH
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ApprovalTokens'
ORDER BY ORDINAL_POSITION;

-- Check indexes
SELECT 
    i.name as IndexName,
    c.name as ColumnName
FROM sys.indexes i
INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
WHERE i.object_id = OBJECT_ID('dbo.ApprovalTokens');
```

## Maintenance

### View Active Tokens

```sql
SELECT 
    t.Token,
    u.Email as UserEmail,
    t.Action,
    t.CreatedAt,
    t.ExpiresAt,
    CASE 
        WHEN t.UsedAt IS NOT NULL THEN 'Used'
        WHEN t.ExpiresAt < GETDATE() THEN 'Expired'
        ELSE 'Active'
    END as Status
FROM dbo.ApprovalTokens t
INNER JOIN dbo.Users u ON t.UserID = u.ID
ORDER BY t.CreatedAt DESC;
```

### Clean Up Expired Tokens

Automatic cleanup happens via trigger, but you can manually clean up:

```sql
-- Delete expired tokens older than 30 days
DELETE FROM dbo.ApprovalTokens
WHERE ExpiresAt < DATEADD(DAY, -30, GETDATE())
AND UsedAt IS NULL;
```

### Invalidate All Tokens for a User

If you need to invalidate all tokens for a specific user:

```sql
DELETE FROM dbo.ApprovalTokens
WHERE UserID = @userId;
```

## Example Token Flow

```
1. New User Signs In
   └─> User created with Status='Pending'

2. AccessRequest Component
   └─> Calls /api/notify-admins

3. notify-admins API
   ├─> Generates 3 tokens (Full, Read, Deny)
   ├─> Stores tokens in ApprovalTokens table
   └─> Sends email to admins (or logs in dev)

4. Admin Clicks Link
   └─> Opens /api/approve-access?token=abc123...

5. approve-access API (GET)
   ├─> Validates token
   ├─> Shows confirmation page
   └─> Waits for confirmation

6. Admin Confirms
   └─> approve-access API (POST)
       ├─> Validates token again
       ├─> Updates User status/role
       └─> Marks token as used
```

## Troubleshooting

### Issue: Foreign key constraint error

**Cause**: Users table doesn't exist or user was deleted  
**Solution**: Ensure users-permissions-schema.sql is applied first

### Issue: Token not found

**Cause**: Token expired or was already used  
**Solution**: Check UsedAt and ExpiresAt columns in database

### Issue: Trigger errors

**Cause**: Syntax errors in SQL Server version  
**Solution**: Ensure using SQL Server 2016+ or Azure SQL Database

## Related Files

- `/api/notify-admins/index.js` - Generates tokens
- `/api/approve-access/index.js` - Validates and uses tokens
- `/database/users-permissions-schema.sql` - Required Users table
- `/docs/EMAIL_SETUP.md` - Email integration guide

## Migration Path

If upgrading from a version without approval tokens:

1. **Backup your database**
2. Apply `approval-tokens-schema.sql`
3. No data migration needed (table starts empty)
4. Existing users continue to work normally
5. New pending users will trigger token generation

## Performance Considerations

- **Storage**: ~300 bytes per token
- **Indexes**: Token and ExpiresAt are indexed for fast lookups
- **Cleanup**: Trigger-based cleanup on insert (minimal overhead)
- **Scalability**: Suitable for 1000s of approval requests

For a typical family app with 5-10 new users per year:
- Storage: ~1KB per year
- Query performance: <1ms for token lookups
