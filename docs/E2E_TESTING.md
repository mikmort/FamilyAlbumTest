# End-to-End Testing Guide for Coding Agents

This guide explains how GitHub Copilot and other coding agents can run Playwright E2E tests against the deployed Family Album application.

## Overview

The Family Album application uses a hybrid testing approach:

- **Local Development**: Tests run against `localhost:3000` with dev mode authentication
- **E2E Testing**: Tests run against deployed Azure Static Web Apps with real authentication and API

This approach solves the GitHub Actions network restriction that prevents Azure Functions from downloading extension bundles from `cdn.functions.azure.com`.

## Quick Start for Coding Agents

### 1. Trigger E2E Tests

To run E2E tests in GitHub Actions:

```bash
# Manually trigger the E2E test workflow
gh workflow run e2e-tests.yml
```

Or wait for automatic execution after deployment:
- E2E tests run automatically after successful deployment to Azure Static Web Apps
- Workflow: `.github/workflows/e2e-tests.yml`

### 2. View Test Results

```bash
# List recent workflow runs
gh run list --workflow=e2e-tests.yml

# View specific run details
gh run view <run-id>

# Download test artifacts (reports, screenshots)
gh run download <run-id>
```

## Configuration Requirements

### Required GitHub Secrets

The E2E testing workflow requires these secrets to be configured:

| Secret | Description | Required? |
|--------|-------------|-----------|
| `PRODUCTION_URL` | Azure Static Web Apps URL | **Yes** - Critical for E2E tests |
| `AZURE_SQL_SERVER` | SQL Server hostname | Recommended for full testing |
| `AZURE_SQL_DATABASE` | Database name | Recommended for full testing |
| `AZURE_SQL_USER` | Database username | Recommended for full testing |
| `AZURE_SQL_PASSWORD` | Database password | Recommended for full testing |
| `AZURE_STORAGE_ACCOUNT` | Storage account name | Recommended for upload tests |
| `AZURE_STORAGE_KEY` | Storage account key | Recommended for upload tests |
| `AZURE_STORAGE_CONTAINER` | Container name | Recommended for upload tests |

**To find your production URL:**
1. Go to Azure Portal → Static Web Apps
2. Find your app (e.g., "family-album-prod")
3. Copy the URL from Overview (e.g., `https://your-app.azurestaticapps.net`)

### Adding Secrets

```bash
# Using GitHub CLI
gh secret set PRODUCTION_URL -b "https://your-app.azurestaticapps.net"

# Or via GitHub UI
# Settings → Secrets and variables → Actions → New repository secret
```

## How It Works

### Playwright Configuration

The `playwright.config.ts` file automatically detects the testing mode:

```typescript
use: {
  // Use PRODUCTION_URL for E2E testing, or localhost for local dev
  baseURL: process.env.PRODUCTION_URL || 'http://localhost:3000',
  // ... other settings
},

// Skip starting dev server when testing production
webServer: process.env.PRODUCTION_URL ? undefined : {
  command: 'npm run dev',
  url: 'http://localhost:3000',
  // ... dev server config
},
```

### E2E Workflow

`.github/workflows/e2e-tests.yml` does the following:

1. **Triggers**:
   - Automatically after successful Azure Static Web Apps deployment
   - Manually via workflow dispatch

2. **Setup**:
   - Installs dependencies and Playwright browsers
   - Sets `PRODUCTION_URL` from GitHub Secrets

3. **Execution**:
   - Runs Playwright tests with `PRODUCTION_URL` set
   - Tests hit the deployed production site (not localhost)
   - Uses real Azure Functions API (already deployed and working)

4. **Results**:
   - Uploads test reports and screenshots as artifacts
   - Available for download for 30 days

## Testing Workflow for Coding Agents

### Scenario 1: After Making Changes

When you make code changes that affect functionality:

1. Push changes to trigger deployment workflow
2. Wait for deployment to complete successfully
3. E2E tests automatically run against updated production site
4. Review test results in GitHub Actions

### Scenario 2: Manual Testing

To run E2E tests without deploying:

```bash
# Trigger E2E tests manually
gh workflow run e2e-tests.yml

# Wait for completion and check status
gh run watch

# Download artifacts
gh run download
```

### Scenario 3: Local Testing

For rapid iteration during development:

```bash
# Run tests locally against localhost
npm test

# Or run specific tests
npx playwright test tests/media-gallery.spec.ts
```

**Note**: Local testing uses DEV_MODE authentication bypass and requires a running dev server.

## Authentication in E2E Tests

### Local Testing
- Uses `DEV_MODE=true` to bypass authentication
- Set via environment variables in `playwright.config.ts`
- User role: Admin (configurable via `DEV_USER_ROLE`)

### E2E Testing (Production)
- Uses **real** Azure Static Web Apps authentication
- Tests must handle actual login flows (Microsoft/Google OAuth)
- Tests can access user-specific features with proper authentication

**Important**: Current E2E tests may need to be updated to handle real authentication flows. Consider:
- Adding test user credentials as secrets
- Implementing OAuth mocking for automated tests
- Or using API tokens for authentication bypass in test environments

## Common Issues and Solutions

### Issue: E2E Tests Fail with "Cannot connect"

**Cause**: `PRODUCTION_URL` secret not configured

**Solution**:
```bash
gh secret set PRODUCTION_URL -b "https://your-app.azurestaticapps.net"
```

### Issue: Tests Pass Locally but Fail in E2E

**Possible causes**:
1. Authentication differences (DEV_MODE vs real auth)
2. Database state differences
3. Environment-specific configuration

**Solution**: Review test logs and screenshots in GitHub Actions artifacts

### Issue: E2E Workflow Doesn't Trigger After Deployment

**Cause**: Deployment workflow name mismatch

**Solution**: Verify workflow name in `.github/workflows/e2e-tests.yml` matches deployment workflow name:
```yaml
workflow_run:
  workflows: ["Deploy to Azure Static Web Apps"]  # Must match exactly
```

## Best Practices

1. **Always check E2E test results** after deployment
2. **Use local tests for rapid iteration** during development
3. **Review test artifacts** (screenshots, videos) when tests fail
4. **Keep test data clean** - avoid testing with sensitive production data
5. **Monitor test duration** - optimize slow tests to keep feedback fast

## Advanced Usage

### Running Specific Tests in E2E

Modify `.github/workflows/e2e-tests.yml` to run specific test files:

```yaml
- name: Run E2E tests against production
  run: npx playwright test tests/media-gallery.spec.ts --project=chromium
```

### Testing Different Environments

You can create multiple workflows for different environments:

```yaml
# e2e-tests-staging.yml
env:
  PRODUCTION_URL: ${{ secrets.STAGING_URL }}
```

### Debugging Failed E2E Tests

```bash
# Download test results
gh run download <run-id>

# View HTML report locally
cd playwright-report
npx http-server

# Open browser to http://localhost:8080
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                      GitHub Actions                          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  1. Deploy Workflow                                   │  │
│  │     - Build Next.js static export                     │  │
│  │     - Deploy to Azure Static Web Apps                 │  │
│  │     - Triggers E2E workflow on success                │  │
│  └──────────────────────────────────────────────────────┘  │
│                             │                                │
│                             ▼                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  2. E2E Test Workflow                                 │  │
│  │     - Set PRODUCTION_URL from secrets                 │  │
│  │     - Run Playwright tests                            │  │
│  │     - Upload results/artifacts                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                             │                                │
└─────────────────────────────┼────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │  Azure Static Web App │
                    │  - Frontend (Next.js) │
                    │  - API (Functions)    │
                    │  - SQL Database       │
                    │  - Blob Storage       │
                    └──────────────────────┘
```

## Summary

E2E testing for coding agents:
- ✅ Tests run against deployed production site
- ✅ No need to run local Azure Functions server
- ✅ Automatic execution after deployment
- ✅ Full integration testing with real API
- ✅ GitHub Secrets provide credentials
- ✅ Test results available as artifacts

For more details, see:
- [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Secret configuration
- [TESTING_QUICK_START.md](../TESTING_QUICK_START.md) - Local testing guide
- [playwright.config.ts](../playwright.config.ts) - Playwright configuration
