# Development Mode Testing Guide

This guide explains how to use the development mode feature for testing the Family Album application without requiring OAuth authentication.

## Overview

The Family Album application uses role-based access control (RBAC) with Microsoft and Google OAuth authentication. While this is great for production security, it makes automated testing and development difficult.

**Dev Mode** solves this problem by allowing you to bypass authentication during development and testing.

## When to Use Dev Mode

Dev mode is intended for:

- ✅ Local development and testing
- ✅ Automated tests (Playwright, Jest, etc.)
- ✅ GitHub Copilot automated verification
- ✅ CI/CD pipeline testing
- ✅ Quick prototyping and experimentation

Dev mode should **NEVER** be used for:

- ❌ Production environments
- ❌ Staging environments with real data
- ❌ Public demos
- ❌ Any environment accessible to end users

## How It Works

### Architecture

When `DEV_MODE=true` is set in the environment:

1. The `checkAuthorization()` function in `/api/shared/auth.js` detects dev mode
2. Instead of validating OAuth tokens, it returns a mock user
3. The mock user has the email and role specified in environment variables
4. API endpoints work as if the user is authenticated
5. A warning is logged to help prevent accidental production use

### Code Implementation

The dev mode check happens early in the authorization flow:

```javascript
async function checkAuthorization(context, requiredRole = 'Read') {
  // Dev mode bypass for testing (only in development)
  if (process.env.DEV_MODE === 'true') {
    const devEmail = process.env.DEV_USER_EMAIL || 'dev@example.com';
    const devRole = process.env.DEV_USER_ROLE || 'Admin';
    
    context.log.warn(`DEV MODE: Bypassing authentication. User: ${devEmail}, Role: ${devRole}`);
    
    return {
      authorized: true,
      user: {
        ID: 0,
        Email: devEmail,
        Role: devRole,
        Status: 'Active',
        LastLoginAt: new Date(),
        Notes: 'Dev mode user'
      },
      error: null
    };
  }
  
  // Normal authentication flow continues...
}
```

## Setup Instructions

### Step 1: Configure Environment Variables

Create or edit `.env.local` in the repository root:

```env
# Enable development mode
DEV_MODE=true

# Configure mock user (optional, these are the defaults)
DEV_USER_EMAIL=dev@example.com
DEV_USER_ROLE=Admin
```

### Step 2: Set Database and Storage (Optional)

If you need to test with actual data:

```env
# Azure SQL Database
AZURE_SQL_SERVER=your-dev-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum-Dev
AZURE_SQL_USER=devuser
AZURE_SQL_PASSWORD=devpassword

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=devstorageaccount
AZURE_STORAGE_KEY=devkey
AZURE_STORAGE_CONTAINER=family-album-media-dev
```

**Tip**: Use separate dev/test databases and storage containers to avoid affecting production data.

### Step 3: Start Development Server

```bash
npm run dev
```

The server will start on `http://localhost:3000` with dev mode enabled.

### Step 4: Verify Dev Mode is Active

Check the console output when making API calls. You should see:

```
[WARNING] DEV MODE: Bypassing authentication. User: dev@example.com, Role: Admin
```

## User Roles

You can simulate different users by changing `DEV_USER_ROLE`:

### Admin Role
```env
DEV_USER_ROLE=Admin
```
- Full access to all features
- Can manage users
- Can upload and edit media
- Can manage people and events

### Full Role
```env
DEV_USER_ROLE=Full
```
- Can upload and edit media
- Can manage people and events
- Cannot manage users

### Read Role
```env
DEV_USER_ROLE=Read
```
- Can only view media
- Cannot upload or edit
- Cannot manage anything

## Testing Workflows

### Manual Testing

1. Set `DEV_MODE=true` in `.env.local`
2. Set desired role with `DEV_USER_ROLE`
3. Run `npm run dev`
4. Browse to `http://localhost:3000`
5. Test features as the simulated user

### Automated Testing with Playwright

Playwright is pre-configured to use dev mode automatically:

```bash
# Run all tests
npm test

# Run specific test
npx playwright test tests/navigation.spec.ts

# Run with browser visible
npm run test:headed
```

The `playwright.config.ts` file automatically sets dev mode:

```typescript
webServer: {
  command: 'npm run dev',
  env: {
    DEV_MODE: 'true',
    DEV_USER_EMAIL: 'test@example.com',
    DEV_USER_ROLE: 'Admin',
  },
}
```

### Testing Different Roles

Create separate test files for different roles:

```typescript
// tests/admin-features.spec.ts
test.describe('Admin Features', () => {
  test.use({
    extraHTTPHeaders: {
      'X-Test-Role': 'Admin'  // If you extend dev mode to support this
    }
  });
  
  test('should manage users', async ({ page }) => {
    // Admin-only test
  });
});
```

Or run tests with different environment variables:

```bash
DEV_USER_ROLE=Read npm test tests/read-only.spec.ts
DEV_USER_ROLE=Full npm test tests/full-access.spec.ts
```

## GitHub Copilot Usage

GitHub Copilot automatically uses dev mode when testing:

**Example prompts:**

- "Test the media gallery functionality"
- "Run the test suite"
- "Navigate to the app and verify the people selector works"
- "Test uploading media with a Full role user"

Copilot will:
1. Read the `.github/copilot-instructions.md` file
2. Set up dev mode environment
3. Run the development server
4. Execute tests or navigate manually
5. Verify functionality

## Security Considerations

### Protection Against Production Use

Dev mode has several safeguards:

1. **Explicit Configuration**: Must set `DEV_MODE=true` explicitly
2. **Warning Logs**: Logs a warning on every API call
3. **Not in Azure**: Azure Static Web Apps doesn't have this env var
4. **Not in Version Control**: `.env.local` is in `.gitignore`

### Best Practices

1. **Never commit** `.env.local` with `DEV_MODE=true`
2. **Use separate resources** for dev/test (database, storage)
3. **Clear dev mode** before deploying
4. **Monitor logs** for unexpected dev mode warnings
5. **Code reviews** should check for dev mode configurations

### Auditing

To check if dev mode is accidentally enabled in production:

```bash
# Check environment variables
printenv | grep DEV_MODE

# Check application configuration in Azure Portal
# Go to: Configuration > Application settings
# Look for: DEV_MODE
```

If you see `DEV_MODE=true` in production:
1. Immediately remove the environment variable
2. Restart the application
3. Investigate how it was set
4. Review recent deployments

## Troubleshooting

### Dev Mode Not Working

**Symptom**: Still getting authentication errors

**Solutions**:
1. Verify `.env.local` exists and contains `DEV_MODE=true`
2. Restart the development server (`npm run dev`)
3. Check for typos in environment variable names
4. Ensure you're using the latest code with dev mode support
5. Check the console for dev mode warning logs

### Tests Fail with Authentication Errors

**Symptom**: Playwright tests return 401/403 errors

**Solutions**:
1. Check `playwright.config.ts` has dev mode env vars
2. Restart the test suite
3. Clear the Playwright cache: `rm -rf playwright/.cache`
4. Verify auth.js has the dev mode code

### Database Errors in Dev Mode

**Symptom**: API returns 500 errors about database

**Solutions**:
1. Dev mode bypasses auth but still needs database
2. Either set up a test database in `.env.local`
3. Or modify API endpoints to return mock data
4. Or use a database emulator

### Dev Mode Warning in Production

**Symptom**: Production logs show dev mode warnings

**Solutions**:
1. **URGENT**: Remove `DEV_MODE` from production environment
2. Restart the application immediately
3. Investigate the deployment process
4. Add checks to CI/CD to prevent this

## Advanced Usage

### Mock Data Without Database

For unit tests, you might want dev mode without a database:

```javascript
// In your API endpoint
if (process.env.DEV_MODE === 'true' && process.env.USE_MOCK_DATA === 'true') {
  return {
    media: [
      { PFileName: 'test1.jpg', PType: 'jpg' },
      { PFileName: 'test2.mp4', PType: 'mp4' }
    ],
    pagination: { totalCount: 2, currentPage: 1 }
  };
}
```

### Multiple Test Users

To test with multiple users simultaneously:

```javascript
// tests/multi-user.spec.ts
test.describe('Multi-user scenarios', () => {
  test('admin and reader interact', async ({ browser }) => {
    // Create admin context
    const adminContext = await browser.newContext({
      extraHTTPHeaders: {
        'X-Dev-User': 'admin@example.com',
        'X-Dev-Role': 'Admin'
      }
    });
    
    // Create reader context
    const readerContext = await browser.newContext({
      extraHTTPHeaders: {
        'X-Dev-User': 'reader@example.com',
        'X-Dev-Role': 'Read'
      }
    });
    
    // Test interactions...
  });
});
```

**Note**: This requires extending the dev mode code to read custom headers.

### Conditional Features

Enable experimental features only in dev mode:

```javascript
if (process.env.DEV_MODE === 'true' && process.env.EXPERIMENTAL_FEATURES === 'true') {
  // Enable experimental feature
}
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests with dev mode
        run: npm test
        env:
          DEV_MODE: true
          DEV_USER_EMAIL: ci-test@example.com
          DEV_USER_ROLE: Admin
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: playwright-report/
```

### Azure DevOps Example

```yaml
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

steps:
  - task: NodeTool@0
    inputs:
      versionSpec: '18.x'
  
  - script: npm ci
    displayName: 'Install dependencies'
  
  - script: npm test
    displayName: 'Run tests'
    env:
      DEV_MODE: true
      DEV_USER_EMAIL: ci-test@example.com
      DEV_USER_ROLE: Admin
  
  - task: PublishTestResults@2
    condition: always()
    inputs:
      testResultsFiles: 'playwright-report/**/*.xml'
```

## Resources

- Main documentation: [README.md](../README.md)
- Test suite guide: [tests/README.md](../tests/README.md)
- Copilot instructions: [.github/copilot-instructions.md](../.github/copilot-instructions.md)
- RBAC system: [RBAC_SYSTEM.md](./RBAC_SYSTEM.md)

## Support

If you have questions or issues with dev mode:

1. Check this documentation
2. Review the code in `/api/shared/auth.js`
3. Look at test examples in `/tests`
4. Check Copilot instructions for guidance
