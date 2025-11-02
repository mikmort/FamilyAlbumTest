# Email Approval Feature - Testing Guide

This document provides a comprehensive testing plan for the email-based user approval feature.

## Prerequisites

Before testing, ensure:
- [ ] Database schema is applied (`database/approval-tokens-schema.sql`)
- [ ] At least one admin user exists in the database with `Role='Admin'` and `Status='Active'`
- [ ] Environment variables are set (see below)

### Required Environment Variables

```env
SITE_URL=https://your-app.azurestaticapps.net
EMAIL_FROM_ADDRESS=noreply@your-domain.com

# Optional: For actual email sending (one of the following)
AZURE_COMMUNICATION_CONNECTION_STRING=...
# OR
SENDGRID_API_KEY=...
```

## Testing Scenarios

### Scenario 1: New User Sign-In (Without Email Service)

**Objective**: Verify token generation and logging work correctly

**Steps**:
1. Sign in with a new user account (not in the database)
2. Check Azure Function logs for the following:
   - User created with `Status='Pending'`
   - Three approval tokens generated
   - Three approval URLs logged
   - URLs contain base URL and token parameters

**Expected Results**:
```
📧 Would send email notification to: admin@example.com
Subject: New Access Request - Family Album

Body:
A new user is requesting access to the Family Album:
  User: John Doe
  Email: john.doe@example.com
  Message: New user requesting access to Family Album
  Time: 2025-11-02T...

Please click one of the following links to approve or deny access:

✅ Approve (Full Access): https://your-app.azurestaticapps.net/api/approve-access?token=...
📖 Approve (Read Only): https://your-app.azurestaticapps.net/api/approve-access?token=...
❌ Deny Access: https://your-app.azurestaticapps.net/api/approve-access?token=...

These links will expire on: ...
```

**Database Verification**:
```sql
-- Check user created
SELECT * FROM dbo.Users WHERE Email = 'john.doe@example.com';
-- Should show: Status='Pending', Role='Read'

-- Check tokens created
SELECT Token, Action, ExpiresAt, UsedAt 
FROM dbo.ApprovalTokens t
INNER JOIN dbo.Users u ON t.UserID = u.ID
WHERE u.Email = 'john.doe@example.com';
-- Should show 3 tokens: FullAccess, ReadOnly, Deny
-- UsedAt should be NULL for all
```

### Scenario 2: Access Approval Link (Full Access)

**Objective**: Verify approval confirmation page displays correctly

**Steps**:
1. Copy the "Full Access" URL from logs
2. Open URL in browser (can be incognito/different browser - no login required)
3. Verify confirmation page displays:
   - Checkmark icon (✅)
   - User email
   - "Approve with Full Access" text
   - Confirm and Cancel buttons

**Expected Results**:
- Clean, centered confirmation page
- Accurate user information
- Working buttons

### Scenario 3: Confirm Approval (Full Access)

**Objective**: Verify user status is updated correctly

**Steps**:
1. On confirmation page, click "Confirm" button
2. Wait for success message
3. Check database

**Expected Results**:
- Success message: "✅ Success! The action has been completed successfully."
- Database changes:
  ```sql
  SELECT Email, Role, Status, ApprovedAt, ApprovedBy 
  FROM dbo.Users 
  WHERE Email = 'john.doe@example.com';
  -- Should show: Role='Full', Status='Active', ApprovedAt=NOW, ApprovedBy='System'
  
  SELECT Token, UsedAt, UsedBy 
  FROM dbo.ApprovalTokens t
  INNER JOIN dbo.Users u ON t.UserID = u.ID
  WHERE u.Email = 'john.doe@example.com' AND t.Action = 'FullAccess';
  -- Should show: UsedAt=NOW, UsedBy='System'
  ```

### Scenario 4: User Can Now Access App

**Objective**: Verify approved user can access the application

**Steps**:
1. As the newly approved user (john.doe@example.com)
2. Go to the main app URL
3. Sign in if not already signed in
4. Verify you can access the application

**Expected Results**:
- User sees the main application interface
- No "Access Pending" message
- Full access to all features (if approved with Full Access)

### Scenario 5: Token Reuse Prevention

**Objective**: Verify tokens can only be used once

**Steps**:
1. Try to access the same approval URL again (from Scenario 2)
2. Verify error/already-used message

**Expected Results**:
- Page shows: "Already Processed"
- Message: "This approval link has already been used."
- Timestamp of when it was processed

### Scenario 6: Read-Only Approval

**Objective**: Verify Read-Only approval works correctly

**Steps**:
1. Create another new user
2. Get the "Read Only" approval URL from logs
3. Open URL and click Confirm
4. Check database

**Expected Results**:
```sql
SELECT Email, Role, Status 
FROM dbo.Users 
WHERE Email = 'jane.smith@example.com';
-- Should show: Role='Read', Status='Active'
```

### Scenario 7: Deny Access

**Objective**: Verify deny functionality works correctly

**Steps**:
1. Create another new user
2. Get the "Deny" approval URL from logs
3. Open URL and verify:
   - X icon (❌)
   - Red color scheme
   - "Deny Access" text
4. Click Confirm
5. Check database

**Expected Results**:
```sql
SELECT Email, Role, Status 
FROM dbo.Users 
WHERE Email = 'bob.jones@example.com';
-- Should show: Role='Read' (unchanged), Status='Denied'
```

**User Experience**:
- User tries to access app
- Sees "Access Denied" message
- Cannot access application

### Scenario 8: Token Expiration

**Objective**: Verify expired tokens are rejected

**Steps**:
1. Create a test token that's already expired:
   ```sql
   -- Manually insert expired token for testing
   INSERT INTO dbo.ApprovalTokens (Token, UserID, Action, ExpiresAt)
   VALUES ('expired-test-token', 1, 'FullAccess', DATEADD(DAY, -1, GETDATE()));
   ```
2. Try to access: `https://your-app.azurestaticapps.net/api/approve-access?token=expired-test-token`

**Expected Results**:
- Page shows: "Link Expired"
- Message: "This approval link has expired."
- Shows expiration date

### Scenario 9: Invalid Token

**Objective**: Verify invalid tokens are rejected

**Steps**:
1. Try to access URL with random token:
   `https://your-app.azurestaticapps.net/api/approve-access?token=invalid-random-token`

**Expected Results**:
- Page shows: "Invalid Token"
- Message: "This approval link is invalid or has been removed."

### Scenario 10: Email Integration Test (Optional)

**Objective**: Verify actual email sending works (if email service is configured)

**Prerequisites**:
- Email service configured (Azure Communication Services or SendGrid)
- Environment variables set

**Steps**:
1. Sign in as a new user
2. Check admin email inbox
3. Verify email received with:
   - Correct subject line
   - User information
   - Three clickable links
   - Professional formatting

**Expected Results**:
- Email delivered within 1-2 minutes
- All links are clickable
- Links work correctly

## Automated Testing Scripts

### Database Setup Verification

```sql
-- Verify schema is correct
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'ApprovalTokens'
ORDER BY ORDINAL_POSITION;

-- Verify indexes exist
SELECT name FROM sys.indexes 
WHERE object_id = OBJECT_ID('dbo.ApprovalTokens');

-- Verify trigger exists
SELECT name FROM sys.triggers 
WHERE parent_id = OBJECT_ID('dbo.ApprovalTokens');
```

### Token Validation

```sql
-- Check for active tokens
SELECT 
    u.Email,
    t.Action,
    t.CreatedAt,
    t.ExpiresAt,
    t.UsedAt,
    CASE 
        WHEN t.UsedAt IS NOT NULL THEN 'Used'
        WHEN t.ExpiresAt < GETDATE() THEN 'Expired'
        ELSE 'Active'
    END as Status
FROM dbo.ApprovalTokens t
INNER JOIN dbo.Users u ON t.UserID = u.ID
ORDER BY t.CreatedAt DESC;
```

### Cleanup Test Data

```sql
-- Remove test users and their tokens (cascade delete)
DELETE FROM dbo.Users 
WHERE Email IN (
    'john.doe@example.com',
    'jane.smith@example.com',
    'bob.jones@example.com'
);

-- Verify cleanup
SELECT COUNT(*) as RemainingTestTokens
FROM dbo.ApprovalTokens t
INNER JOIN dbo.Users u ON t.UserID = u.ID
WHERE u.Email LIKE '%example.com';
-- Should return 0
```

## Common Issues and Solutions

### Issue: "SITE_URL environment variable must be set"

**Cause**: SITE_URL not configured  
**Solution**: Add SITE_URL to Azure Static Web App configuration

### Issue: Approval links return 404

**Cause**: Route not configured in staticwebapp.config.json  
**Solution**: Verify `/api/approve-access` is in allowedRoles for anonymous

### Issue: Token not found in database

**Cause**: Database schema not applied  
**Solution**: Run `database/approval-tokens-schema.sql`

### Issue: User status not updating

**Cause**: Database permissions or foreign key issue  
**Solution**: Check SQL user has UPDATE permissions on Users table

## Performance Testing

### Load Test Scenarios

1. **Concurrent Token Generation**:
   - 10 new users sign in simultaneously
   - Verify all tokens created correctly
   - Check for race conditions

2. **Concurrent Token Usage**:
   - Multiple admins click different tokens at same time
   - Verify each token used correctly
   - No duplicate processing

### Expected Performance

- Token generation: <100ms
- Token validation: <50ms
- User update: <100ms
- Total approval time: <500ms

## Security Testing

### Security Checks

1. **Token Security**:
   - [ ] Tokens are 64 characters long
   - [ ] Tokens use cryptographic random generation
   - [ ] Tokens cannot be guessed or brute-forced

2. **Authorization**:
   - [ ] Anonymous users can access approval links
   - [ ] Expired tokens are rejected
   - [ ] Used tokens are rejected
   - [ ] Invalid tokens are rejected

3. **SQL Injection**:
   - [ ] All queries use parameterized statements
   - [ ] No string concatenation in SQL

4. **XSS Protection**:
   - [ ] HTML pages properly escape user input
   - [ ] Email content doesn't allow script injection

## Reporting Test Results

Document results in this format:

```
Test Date: 2025-11-02
Tester: [Your Name]
Environment: [Production/Staging/Dev]

Scenario 1: ✅ Pass
Scenario 2: ✅ Pass
Scenario 3: ✅ Pass
Scenario 4: ✅ Pass
Scenario 5: ✅ Pass
Scenario 6: ✅ Pass
Scenario 7: ✅ Pass
Scenario 8: ✅ Pass
Scenario 9: ✅ Pass
Scenario 10: ⏭️ Skipped (no email service)

Issues Found: None
Notes: All features working as expected
```

## Next Steps After Testing

1. Configure email service (if not already done)
2. Test with real admin email addresses
3. Monitor logs for first week of production
4. Set up alerts for failed approvals
5. Review and optimize based on usage patterns
