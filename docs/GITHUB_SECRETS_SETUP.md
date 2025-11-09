# GitHub Secrets Configuration for Testing

This document explains how to configure GitHub Secrets to enable full Playwright testing with the coding agent and CI/CD workflows.

## Overview

The Family Album application uses Azure SQL Database and Azure Blob Storage. To run tests that interact with these services, you need to configure GitHub Secrets with your Azure credentials.

**Important**: Dev mode bypasses authentication, but tests still need database and storage access to function fully. However, tests can run in a limited capacity without these secrets.

## Required GitHub Secrets

Navigate to your repository settings: **Settings** → **Secrets and variables** → **Actions**

Add the following secrets:

### Azure SQL Database Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AZURE_SQL_SERVER` | Azure SQL Server hostname | `your-server.database.windows.net` |
| `AZURE_SQL_DATABASE` | Database name | `FamilyAlbum` or `FamilyAlbum-Test` |
| `AZURE_SQL_USER` | Database username | `dbadmin` or `testuser` |
| `AZURE_SQL_PASSWORD` | Database password | `YourSecurePassword123!` |

### Azure Blob Storage Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `AZURE_STORAGE_ACCOUNT` | Storage account name | `familyalbumtest` |
| `AZURE_STORAGE_KEY` | Storage account access key | `base64-encoded-key` |
| `AZURE_STORAGE_CONTAINER` | Container name | `family-album-media` or `test-media` |

## Setup Instructions

### Step 1: Create Test Database (Recommended)

For testing, it's best to create a separate test database to avoid affecting production data:

1. In Azure Portal, create a new Azure SQL Database:
   - Name: `FamilyAlbum-Test`
   - Tier: Basic or Serverless (for cost savings)
   
2. Run the schema scripts from `/database` directory to set up tables:
   ```bash
   # Use Azure Data Studio or sqlcmd
   sqlcmd -S your-server.database.windows.net -d FamilyAlbum-Test -U testuser -P password -i database/schema.sql
   ```

3. Optionally add test data (people, events, media) for more comprehensive testing

### Step 2: Create Test Storage Container

Create a separate blob storage container for test media:

1. In Azure Portal, navigate to your Storage Account
2. Create a new container:
   - Name: `test-media` or `family-album-media-test`
   - Public access level: Private (default)
   
3. Upload some test images/videos (optional) for media gallery tests

### Step 3: Configure Firewall Rules

Ensure GitHub Actions runners can access your Azure resources:

#### Azure SQL Firewall
1. Navigate to your SQL Server in Azure Portal
2. Go to **Security** → **Networking**
3. Enable: ✅ **Allow Azure services and resources to access this server**
4. This allows GitHub Actions (which runs on Azure) to connect

#### Storage Account Firewall
1. Navigate to your Storage Account
2. Go to **Security + networking** → **Networking**
3. Under **Firewall and virtual networks**:
   - Select: **Enabled from all networks** (for testing)
   - OR Select: **Enabled from selected virtual networks and IP addresses**
     - Then add: ✅ **Allow Azure services on the trusted services list to access this storage account**

### Step 4: Add Secrets to GitHub

1. Go to your repository on GitHub
2. Navigate to: **Settings** → **Secrets and variables** → **Actions**
3. Click: **New repository secret**
4. Add each secret from the tables above

### Step 5: Verify Setup

After adding secrets, trigger the Playwright workflow:

1. Go to: **Actions** tab in GitHub
2. Select: **Playwright Tests** workflow
3. Click: **Run workflow** → **Run workflow**
4. Monitor the test results

## Testing Locally with Coding Agent

When GitHub Copilot or other coding agents run tests, they automatically use the configured GitHub Secrets. The secrets are available as environment variables.

### For Manual Local Testing

Create a `.env.local` file (not committed to git):

```env
# Development Mode (for testing without OAuth)
DEV_MODE=true
DEV_USER_EMAIL=dev@example.com
DEV_USER_ROLE=Admin

# Azure SQL Database
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum-Test
AZURE_SQL_USER=testuser
AZURE_SQL_PASSWORD=YourPassword123!

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=yourstorageaccount
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONTAINER=test-media
```

Then run tests:
```bash
npm test
```

## Security Considerations

### ✅ Best Practices

1. **Use Test Resources**: Always use separate test database and storage containers
2. **Limit Permissions**: Create dedicated test accounts with minimal required permissions
3. **Rotate Keys**: Regularly rotate storage keys and database passwords
4. **Monitor Usage**: Review test resource usage in Azure Portal
5. **Use Firewall Rules**: Restrict access to only Azure services when possible

### ⚠️ Security Notes

- GitHub Secrets are encrypted and only exposed to workflows
- Secrets are not visible in logs or test output
- Failed test logs are automatically scrubbed of secrets
- Coding agents running in GitHub Actions have temporary access to secrets

### 🔒 Database Permissions

For test database user, grant only necessary permissions:

```sql
-- Create test user with limited permissions
CREATE USER testuser WITH PASSWORD = 'YourPassword123!';

-- Grant read/write but not schema changes
ALTER ROLE db_datareader ADD MEMBER testuser;
ALTER ROLE db_datawriter ADD MEMBER testuser;

-- For tests that need to create/modify schema (integration tests)
ALTER ROLE db_ddladmin ADD MEMBER testuser;
```

## Testing Without Secrets

Tests can run in a limited mode without Azure credentials:

1. **Frontend Tests**: UI navigation, component rendering
2. **API Mock Tests**: With mocked database responses
3. **Auth Tests**: Dev mode authentication bypass

Some tests may fail if they require actual database or storage access.

To run only frontend tests:
```bash
npm test -- tests/navigation.spec.ts
```

## Troubleshooting

### Tests Fail with Database Connection Error

**Problem**: `ConnectionError: Failed to connect to database`

**Solutions**:
1. Verify `AZURE_SQL_*` secrets are configured correctly
2. Check database firewall allows Azure services
3. Ensure database is not paused (serverless tier)
4. Test connection manually:
   ```bash
   sqlcmd -S server.database.windows.net -d database -U user -P password -Q "SELECT 1"
   ```

### Tests Fail with Storage Error

**Problem**: `StorageError: Authentication failed`

**Solutions**:
1. Verify `AZURE_STORAGE_*` secrets are correct
2. Check storage account key hasn't been rotated
3. Ensure container exists
4. Verify firewall rules allow GitHub Actions

### Secrets Not Available in Workflow

**Problem**: Environment variables are undefined

**Solutions**:
1. Check secret names exactly match (case-sensitive)
2. Verify secrets are added to the correct repository
3. Re-run the workflow after adding secrets
4. Check workflow syntax for correct secret reference: `${{ secrets.SECRET_NAME }}`

### Tests Pass Locally but Fail in CI

**Problem**: Tests work with local `.env.local` but fail in GitHub Actions

**Solutions**:
1. Ensure all `.env.local` variables are added as GitHub Secrets
2. Check workflow file includes all necessary env vars
3. Verify Azure firewall rules allow GitHub Actions runners
4. Test with same data that exists in test database

## Alternative: Mock Data for Testing

If you don't want to configure Azure resources for testing, you can modify tests to use mock data:

1. Create test fixtures in `/tests/fixtures`
2. Mock API responses in test setup
3. Skip tests that require real database/storage

Example:
```typescript
// tests/fixtures/people.ts
export const mockPeople = [
  { ID: 1, NeName: 'John Doe', neType: 'N' },
  { ID: 2, NeName: 'Jane Smith', neType: 'N' }
];

// In test file
test.beforeEach(({ page }) => {
  page.route('/api/people', route => 
    route.fulfill({ json: mockPeople })
  );
});
```

## Resources

- [GitHub Actions: Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Azure SQL Database Firewall Rules](https://docs.microsoft.com/azure/azure-sql/database/firewall-configure)
- [Azure Storage Account Access Keys](https://docs.microsoft.com/azure/storage/common/storage-account-keys-manage)
- [Playwright Testing Best Practices](https://playwright.dev/docs/best-practices)

## Need Help?

1. Check the test logs in GitHub Actions for specific error messages
2. Review `docs/DEV_MODE_TESTING.md` for dev mode setup
3. See `tests/README.md` for test suite documentation
4. Check Azure Portal for resource health and logs
