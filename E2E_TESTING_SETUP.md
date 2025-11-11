# E2E Testing Setup - Quick Reference

## What Was Done

I've set up end-to-end (E2E) Playwright testing for GitHub Copilot and coding agents to test against your **deployed** Azure Static Web Apps site instead of localhost.

### Why This Approach?

GitHub Actions has network restrictions that prevent Azure Functions from downloading extension bundles from `cdn.functions.azure.com`. The solution: test against the deployed production site where the API is already integrated and working.

## Files Modified/Created

1. **`playwright.config.ts`** - Updated to support `PRODUCTION_URL` environment variable
2. **`.github/workflows/e2e-tests.yml`** - New workflow for E2E testing after deployment
3. **`docs/GITHUB_SECRETS_SETUP.md`** - Updated with E2E testing documentation
4. **`docs/E2E_TESTING.md`** - Comprehensive guide for coding agents

## Next Steps

### 1. Add Required GitHub Secret

You need to add your production URL as a GitHub Secret:

```bash
# Option A: Using GitHub CLI
gh secret set PRODUCTION_URL -b "https://your-app.azurestaticapps.net"

# Option B: Via GitHub UI
# Go to: Settings → Secrets and variables → Actions → New repository secret
# Name: PRODUCTION_URL
# Value: https://your-app.azurestaticapps.net
```

**To find your production URL:**
1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to: **Static Web Apps**
3. Select your app (e.g., "family-album-prod")
4. Copy the URL from the **Overview** page

### 2. Test the Setup

**Option A: Wait for automatic trigger**
- Push any changes to trigger deployment
- E2E tests will run automatically after successful deployment

**Option B: Manual trigger**
```bash
gh workflow run e2e-tests.yml
```

**Option C: View workflow in GitHub**
- Go to: **Actions** tab
- Select: **E2E Tests (Production)**
- Click: **Run workflow**

## How It Works

### Local Testing (Default)
```bash
npm test
# Tests against: http://localhost:3000
# Uses: DEV_MODE authentication bypass
# Requires: Local dev server running
```

### E2E Testing (GitHub Actions)
```bash
gh workflow run e2e-tests.yml
# Tests against: PRODUCTION_URL (deployed Azure site)
# Uses: Real authentication and deployed API
# Requires: PRODUCTION_URL secret configured
```

## Test Workflow

```
┌────────────────────────────────────────────────────────┐
│  1. Code changes pushed to GitHub                      │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼
┌────────────────────────────────────────────────────────┐
│  2. Deploy to Azure Static Web Apps                    │
│     (Workflow: azure-static-web-apps.yml)              │
└────────────────┬───────────────────────────────────────┘
                 │
                 ▼ (on success)
┌────────────────────────────────────────────────────────┐
│  3. Run E2E Tests Against Production                   │
│     (Workflow: e2e-tests.yml)                          │
│     - Uses PRODUCTION_URL secret                       │
│     - Tests full deployed application                  │
│     - Uploads test reports and screenshots             │
└────────────────────────────────────────────────────────┘
```

## Benefits for Coding Agents

✅ **No local API server needed** - tests hit deployed Azure Functions
✅ **Automatic execution** - runs after each deployment
✅ **Full integration testing** - validates complete deployed application
✅ **Real authentication** - tests against actual Azure Static Web Apps auth
✅ **Test artifacts available** - screenshots, videos, HTML reports (30 days)

## Testing Modes Comparison

| Feature | Local Testing | E2E Testing |
|---------|--------------|-------------|
| **URL** | `http://localhost:3000` | `PRODUCTION_URL` secret |
| **Auth** | DEV_MODE bypass | Real Azure auth |
| **API** | Local Functions (port 7071) | Deployed Functions |
| **Database** | Local or test database | Production database |
| **Speed** | Fast (no deployment) | Slower (after deployment) |
| **Use Case** | Rapid development | Pre-production validation |

## Troubleshooting

### E2E tests don't run after deployment

**Check**: Workflow trigger name matches in `e2e-tests.yml`:
```yaml
workflow_run:
  workflows: ["Deploy to Azure Static Web Apps"]  # Must match exactly
```

### Tests fail with "Cannot connect to PRODUCTION_URL"

**Solution**: Add the `PRODUCTION_URL` secret:
```bash
gh secret set PRODUCTION_URL -b "https://your-app.azurestaticapps.net"
```

### Tests pass locally but fail in E2E

**Possible causes**:
- Authentication differences (DEV_MODE vs real auth)
- Database state differences
- Environment-specific configuration

**Solution**: Download test artifacts to see screenshots and logs:
```bash
gh run list --workflow=e2e-tests.yml
gh run download <run-id>
```

## Documentation

- **[docs/E2E_TESTING.md](./docs/E2E_TESTING.md)** - Complete guide for coding agents
- **[docs/GITHUB_SECRETS_SETUP.md](./docs/GITHUB_SECRETS_SETUP.md)** - Secret configuration details
- **[.github/workflows/e2e-tests.yml](./.github/workflows/e2e-tests.yml)** - E2E workflow definition
- **[playwright.config.ts](./playwright.config.ts)** - Playwright configuration

## Summary

Your E2E testing is now configured! Just add the `PRODUCTION_URL` secret and tests will run automatically after each deployment to validate your live application.

For coding agents: Tests can now run against your deployed site without needing local Azure Functions, solving the cdn.functions.azure.com network restriction issue.
