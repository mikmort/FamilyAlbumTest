# GitHub Secrets Configuration - Quick Setup

This is a quick reference guide for setting up GitHub Secrets to enable full Playwright testing.

## Why Configure GitHub Secrets?

- ✅ Enables **full test coverage** with real Azure database and storage
- ✅ Allows **GitHub Copilot** to run tests with actual data
- ✅ Enables **automated CI/CD testing** on push/PR
- ✅ **Optional**: Tests can run without secrets (limited functionality)

## 5-Minute Setup

### Step 1: Go to Repository Settings

1. Navigate to your repository on GitHub
2. Click **Settings** (top menu)
3. In left sidebar: **Secrets and variables** → **Actions**
4. Click **New repository secret**

### Step 2: Add These 7 Secrets

Copy these values from your Azure Portal:

| Secret Name | Where to Find in Azure Portal |
|-------------|-------------------------------|
| `AZURE_SQL_SERVER` | SQL Database → Server name (ends with `.database.windows.net`) |
| `AZURE_SQL_DATABASE` | SQL Database → Database name |
| `AZURE_SQL_USER` | SQL Database → Connection strings → Username |
| `AZURE_SQL_PASSWORD` | The password you set when creating the SQL server |
| `AZURE_STORAGE_ACCOUNT` | Storage Account → Account name |
| `AZURE_STORAGE_KEY` | Storage Account → Access keys → key1 |
| `AZURE_STORAGE_CONTAINER` | Storage Account → Containers → Container name |

### Step 3: Verify Setup

1. Push a commit to trigger the Playwright workflow
2. Go to **Actions** tab
3. Watch the **Playwright Tests** workflow run
4. Check that tests pass with database access

## Example Secret Values

```
AZURE_SQL_SERVER=familyalbum-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=sqladmin
AZURE_SQL_PASSWORD=YourSecurePassword123!
AZURE_STORAGE_ACCOUNT=familyalbumstore
AZURE_STORAGE_KEY=AbCdEfGhIjKlMnOpQrStUvWxYz0123456789...
AZURE_STORAGE_CONTAINER=family-album-media
```

## Important Notes

### Use Test Resources (Recommended)

For testing, create **separate test database and storage**:
- Test database: `FamilyAlbum-Test`
- Test container: `test-media`

This prevents tests from affecting production data.

### Firewall Configuration

Ensure GitHub Actions can access Azure:

**SQL Database**:
- Go to SQL Server → Networking
- Enable: ✅ **Allow Azure services and resources to access this server**

**Storage Account**:
- Go to Storage Account → Networking
- Select: **Enabled from all networks** (for testing)
- OR: Enable **Allow Azure services on the trusted services list**

### Testing Without Secrets

If you don't want to configure Azure resources right now:

1. Tests will still run with dev mode
2. Some tests requiring database/storage will fail
3. Frontend and navigation tests will pass
4. You can add secrets later when ready

## Verify Configuration

### After Adding Secrets

1. **Local Testing**:
   ```bash
   npm run test:setup
   ```

2. **CI/CD Testing**:
   - Push any commit
   - Check Actions tab
   - Verify tests pass

### Troubleshooting

**Tests fail with "Connection failed"**:
- Check firewall rules in Azure
- Verify secret names match exactly (case-sensitive)
- Ensure database is not paused (serverless tier)

**Secrets not working**:
- Check secret names have no typos
- Re-run workflow after adding secrets
- Check workflow file syntax

## Next Steps

After configuration:

1. **Run Tests**: `npm run test:setup`
2. **Add More Tests**: Create in `/tests/` directory
3. **Monitor CI/CD**: Tests run automatically on push/PR
4. **Review Reports**: Check Actions artifacts for test results

## Need More Help?

See the comprehensive guides:
- [GitHub Secrets Setup Guide](GITHUB_SECRETS_SETUP.md) - Full documentation
- [Dev Mode Testing Guide](DEV_MODE_TESTING.md) - Dev mode details
- [Coding Agent Quick Start](CODING_AGENT_QUICKSTART.md) - Quick reference

## Security Reminder

- ✅ Secrets are encrypted by GitHub
- ✅ Never commit secrets to code
- ✅ Use test resources, not production
- ✅ Rotate keys regularly
- ✅ Monitor Azure costs and usage
