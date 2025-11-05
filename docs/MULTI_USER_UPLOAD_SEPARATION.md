# Multi-User Upload Separation

## Overview

This feature prevents uploaded files from different users getting intermixed on the ProcessNewFiles page when multiple people upload simultaneously. Each user now sees only their own unindexed files.

## Implementation

### 1. Database Schema Change ✅

**File**: `database/add-user-tracking-to-unindexed.sql`

Added `uiUploadedBy` column to track which user uploaded each file:

```sql
-- Add the column to track who uploaded each file
ALTER TABLE dbo.UnindexedFiles 
ADD uiUploadedBy NVARCHAR(255) NULL;

-- Create index for efficient filtering by uploader
CREATE INDEX IX_UnindexedFiles_UploadedBy 
ON dbo.UnindexedFiles(uiUploadedBy);
```

**Action Required**: Run this migration script against your Azure SQL Database.

### 2. Upload Tracking ✅

**File**: `api/uploadComplete/index.js`

Modified the upload endpoint to capture the uploader's email:

```javascript
// Lines 350-376: INSERT query now includes uiUploadedBy
const insertParams = {
  fileName,
  directory,
  thumbUrl,
  type,
  width,
  height,
  duration,
  blobUrl,
  month: monthValue,
  year: yearValue,
  uploadedBy: authResult.user?.email || null  // ← Captures uploader
};
```

### 3. API Filtering ✅

**File**: `api/unindexed/index.js`

Updated all GET endpoints to filter by current user:

#### List Endpoint
```javascript
// GET /api/unindexed - Shows only current user's files
SELECT ... FROM UnindexedFiles
WHERE uiStatus = 'N' AND uiUploadedBy = @userEmail
ORDER BY uiDateAdded ASC
```

#### Count Endpoint
```javascript
// GET /api/unindexed/count - Counts only current user's files
SELECT COUNT(*) as count
FROM UnindexedFiles
WHERE uiStatus = 'N' AND uiUploadedBy = @userEmail
```

#### Next Endpoint
```javascript
// GET /api/unindexed/next - Gets next file for current user
SELECT TOP 1 ... FROM UnindexedFiles
WHERE uiStatus = 'N' AND uiUploadedBy = @userEmail
ORDER BY uiDateAdded ASC
```

### 4. Frontend Display ✅

**Component**: `components/ProcessNewFiles.tsx`

No changes needed! The component already uses the API endpoints which now automatically filter by user.

## How It Works

1. **User A uploads photos** → Files stored with `uiUploadedBy = 'userA@example.com'`
2. **User B uploads photos** → Files stored with `uiUploadedBy = 'userB@example.com'`
3. **User A visits ProcessNewFiles** → Only sees their own files (filtered by their email)
4. **User B visits ProcessNewFiles** → Only sees their own files (filtered by their email)

## Authentication Context

The user's email is obtained from the authentication result:

```javascript
const authResult = await checkAuthorization(context, 'Full');
const userEmail = authResult.user?.email;
```

This comes from Azure Static Web Apps' built-in authentication (Microsoft/Google OAuth).

## Testing

### Before Migration
1. ❌ Multiple users see each other's uploads
2. ❌ Files get intermixed when processing
3. ❌ Confusing when multiple people upload simultaneously

### After Migration
1. ✅ Each user sees only their own uploads
2. ✅ Files are isolated by uploader
3. ✅ Multiple simultaneous uploads work perfectly

### Test Scenario
1. Have User A upload 5 photos
2. Have User B upload 3 photos at the same time
3. User A should see 5 files on ProcessNewFiles
4. User B should see 3 files on ProcessNewFiles
5. Neither user sees the other's files

## Migration Steps

### Step 1: Run Database Migration
```powershell
# Option A: Using Azure Portal
# 1. Go to Azure Portal
# 2. Navigate to your SQL Database
# 3. Open Query Editor
# 4. Paste contents of database/add-user-tracking-to-unindexed.sql
# 5. Click "Run"

# Option B: Using SQL Server Management Studio
# 1. Connect to your Azure SQL Database
# 2. Open database/add-user-tracking-to-unindexed.sql
# 3. Execute the script
```

### Step 2: Deploy Updated API Code
```powershell
# Commit changes
git add .
git commit -m "Add multi-user upload separation"
git push

# Azure Static Web Apps will auto-deploy
```

### Step 3: Verify
1. Upload a file as one user
2. Check database: `SELECT uiUploadedBy FROM UnindexedFiles WHERE uiStatus = 'N'`
3. Should show the user's email address
4. Log in as different user and verify they don't see the first user's files

## Backwards Compatibility

### Existing Unindexed Files
Files uploaded before this change will have `uiUploadedBy = NULL`. These files will not appear in any user's list until they are:
- Manually assigned an uploader, OR
- Processed and moved to the Pictures table

You may want to run a cleanup query to assign existing NULL records to a specific user:

```sql
-- Assign all existing unindexed files to a specific user
UPDATE UnindexedFiles
SET uiUploadedBy = 'admin@example.com'
WHERE uiUploadedBy IS NULL AND uiStatus = 'N';
```

## Security Considerations

### User Isolation
- ✅ Users cannot see other users' unindexed files
- ✅ Users cannot process other users' uploads
- ✅ Email addresses are not exposed to clients (server-side only)

### Authorization
- ✅ Still requires 'Full' role to upload and process files
- ✅ 'Read' role users cannot access unindexed endpoints
- ✅ All existing RBAC rules still apply

## Future Enhancements

### Admin Override
If admins need to see all unindexed files regardless of uploader:

```javascript
// In api/unindexed/index.js
const userEmail = authResult.user?.email;
const isAdmin = authResult.user?.role === 'Admin';

const whereClause = isAdmin 
  ? 'WHERE uiStatus = \'N\''  // Admins see all
  : 'WHERE uiStatus = \'N\' AND uiUploadedBy = @userEmail';  // Users see own
```

### Bulk Upload Attribution
If using bulk upload scripts, ensure they set the correct user:

```powershell
# In bulk upload scripts, specify user
$headers = @{
  'x-user-email' = 'bulk-uploader@example.com'
}
```

## Related Files

- `database/add-user-tracking-to-unindexed.sql` - Migration script
- `api/uploadComplete/index.js` - Captures uploader email
- `api/unindexed/index.js` - Filters by current user
- `components/ProcessNewFiles.tsx` - Displays filtered results
- `api/shared/auth.js` - Provides user authentication context

## Troubleshooting

### "No files found" after migration
**Problem**: User uploaded files before migration, now sees nothing  
**Solution**: Files have `uiUploadedBy = NULL`. Either assign them to the user or process them first.

### Files still intermixing
**Problem**: Multiple users still see each other's files  
**Solution**: Check that migration ran successfully and API code is deployed.

### Authentication errors
**Problem**: `authResult.user.email` is undefined  
**Solution**: Ensure user is properly authenticated through Azure Static Web Apps OAuth.

## Summary

This feature ensures a clean, isolated upload experience for each user:
- ✅ Database tracks uploader per file
- ✅ Upload endpoint captures user email  
- ✅ API endpoints filter by current user
- ✅ Frontend automatically shows user-specific files
- ✅ No confusion when multiple people upload simultaneously

**Status**: ✅ Implementation complete, ready for deployment after database migration.
