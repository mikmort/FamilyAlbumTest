# Quick Start Guide for GitHub Copilot and Coding Agents

This guide helps GitHub Copilot and other coding agents quickly set up and test the Family Album application.

## TL;DR - Quick Commands

```bash
# Complete setup for GitHub Coding Agent (RECOMMENDED)
npm run setup:agent

# Or setup and test in one command
npm run test:setup

# Or step by step:
npm run setup:env  # Create .env.local with dev mode
npm test           # Run Playwright tests
npm run dev        # Start development server (frontend only)
npm run dev:full   # Start API + frontend (requires Azure Functions)
```

## What's Already Configured

✅ **Dev Mode**: Authentication bypass is implemented and configured  
✅ **Playwright**: Test suite with comprehensive coverage  
✅ **GitHub Secrets**: Available as environment variables in GitHub Actions  
✅ **Auto Setup**: Scripts to create `.env.local` and configure Azure Functions  
✅ **Azure Functions**: Can run locally with Azure Functions Core Tools

## For Coding Agents Running Tests

### Option 1: Complete Setup (Recommended for GitHub Coding Agent)

```bash
# Checks Azure Functions, creates configs, provides guidance
npm run setup:agent
```

This script will:
- Check if Azure Functions Core Tools is installed
- Create `.env.local` with dev mode
- Create `api/local.settings.json` for Azure Functions
- Check for Azure credentials (SQL + Storage)
- Provide next steps based on your environment

### Option 2: Quick Test Setup

```bash
# This creates .env.local and runs tests
npm run test:setup
```

### Option 3: Manual Setup

```bash
# 1. Create .env.local with dev mode enabled
node scripts/setup-env.js

# 2. Create API settings (for Azure Functions)
node scripts/setup-api-env.js

# 3. Run tests
npm test
```

### Option 4: Run Without Database/Storage

Tests can run with limited functionality without Azure credentials:

```bash
# Just create .env.local with dev mode
echo "DEV_MODE=true" > .env.local
echo "DEV_USER_EMAIL=dev@example.com" >> .env.local
echo "DEV_USER_ROLE=Admin" >> .env.local

# Run tests (some may fail without database)
npm test
```

## Available Test Commands

```bash
npm test              # Run all tests (headless)
npm run test:headed   # Run with browser visible
npm run test:debug    # Debug mode (step through)
npm run test:ui       # Interactive test UI
npm run test:report   # View test report

# Run specific tests
npx playwright test tests/navigation.spec.ts
npx playwright test tests/api-endpoints.spec.ts
```

## Environment Variables

### Available from GitHub Secrets (Automatic)

When running in GitHub Actions, these are automatically available:

- `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`
- `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`, `AZURE_STORAGE_CONTAINER`

The `setup-env.js` script reads these and creates `.env.local`.

### Dev Mode (Always Enabled for Testing)

- `DEV_MODE=true` - Bypass authentication
- `DEV_USER_EMAIL=dev@example.com` - Mock user email
- `DEV_USER_ROLE=Admin` - Mock user role (Admin, Full, or Read)

## Test Scenarios

### Scenario 1: Frontend-Only Testing

Test UI components without database:

```bash
# Create minimal .env.local
echo "DEV_MODE=true" > .env.local

# Run navigation tests
npx playwright test tests/navigation.spec.ts
```

### Scenario 2: Full Integration Testing

Test with real Azure database and storage:

```bash
# Setup with GitHub Secrets
npm run setup:env

# Verify secrets loaded
cat .env.local

# Run full test suite
npm test
```

### Scenario 3: API Testing

Test API endpoints:

```bash
# Setup environment
npm run setup:env

# Run API tests
npx playwright test tests/api-endpoints.spec.ts
```

## Troubleshooting

### Issue: "Server is not running"

**Solution**: Tests automatically start the server. Wait 2 minutes for startup.

### Issue: "Database connection failed"

**Solution**: 
1. Tests can run without database (limited functionality)
2. Or configure GitHub Secrets with test database credentials
3. Or mock database responses in tests

### Issue: "Playwright not installed"

**Solution**:
```bash
npx playwright install chromium
```

### Issue: ".env.local not found"

**Solution**:
```bash
npm run setup:env
```

## Understanding Dev Mode

Dev mode bypasses OAuth authentication for testing:

1. **When Enabled**: `DEV_MODE=true` in environment
2. **What It Does**: Returns a mock user from `checkAuthorization()`
3. **Security**: Only works in development, never in production
4. **Configuration**: 
   - Pre-configured in `playwright.config.ts`
   - Can be set in `.env.local` for manual testing

See [docs/DEV_MODE_TESTING.md](../docs/DEV_MODE_TESTING.md) for details.

## Azure Functions (API)

The application uses Azure Functions for its API backend.

### With Azure Functions Core Tools

If `func` command is available, you can run the full stack:

```bash
# Check if installed
func --version

# Start both API and Frontend
npm run dev:full
```

This runs:
- **API**: Azure Functions on `http://localhost:7071`
- **Frontend**: Next.js on `http://localhost:3000`

### Without Azure Functions Core Tools

If `func` is not installed, you can still:
- Run frontend only: `npm run dev`
- Run tests (Playwright starts servers automatically)
- Make frontend changes

### Installing Azure Functions Core Tools

**Linux/Ubuntu:**
```bash
./scripts/install-azure-functions.sh
```

**macOS:**
```bash
brew tap azure/functions
brew install azure-functions-core-tools@4
```

**Windows:**
```powershell
npm install -g azure-functions-core-tools@4
```

**Manual:** https://docs.microsoft.com/azure/azure-functions/functions-run-local

### When Do You Need It?

**Required for:**
- Running API locally for development
- Testing API endpoints manually
- Debugging API functions

**NOT required for:**
- Running Playwright tests (test framework starts servers)
- Frontend-only changes
- Documentation updates
- Reviewing code

## GitHub Actions Integration

The Playwright workflow automatically:

1. Loads GitHub Secrets as environment variables
2. Creates `.env.local` with dev mode enabled
3. Installs Playwright browsers
4. Runs the test suite
5. Uploads test reports and videos

Workflow file: `.github/workflows/playwright.yml`

## Key Files

- `.github/workflows/playwright.yml` - CI/CD test workflow
- `playwright.config.ts` - Playwright configuration with dev mode
- `scripts/setup-env.js` - Environment setup script
- `.env.local.template` - Template with dev mode
- `docs/DEV_MODE_TESTING.md` - Dev mode documentation
- `docs/GITHUB_SECRETS_SETUP.md` - GitHub Secrets guide
- `tests/README.md` - Test suite documentation

## Common Coding Agent Tasks

### Task: Run all tests

```bash
npm run test:setup
```

### Task: Test navigation

```bash
npm run setup:env
npx playwright test tests/navigation.spec.ts
```

### Task: Test API endpoints

```bash
npm run setup:env
npx playwright test tests/api-endpoints.spec.ts
```

### Task: Verify dev mode works

```bash
npm run setup:env
npm run dev  # In background
node tests/verify-dev-mode.js
```

### Task: Add new test

1. Create test file in `/tests/`
2. Import from `@playwright/test`
3. Use dev mode (automatically enabled)
4. Run: `npx playwright test tests/your-test.spec.ts`

Example:
```typescript
import { test, expect } from '@playwright/test';

test('your test', async ({ page }) => {
  await page.goto('/');
  // Dev mode automatically bypasses auth
  // Test your feature...
});
```

## Next Steps

1. **Run tests**: `npm run test:setup`
2. **View results**: Check console output and `playwright-report/`
3. **Debug failures**: Use `npm run test:debug` for failing tests
4. **Verify auth bypass**: Check logs for "DEV MODE: Bypassing authentication"

## Need More Info?

- 📖 [Full Test Documentation](../tests/README.md)
- 🔧 [Dev Mode Guide](../docs/DEV_MODE_TESTING.md)
- 🔐 [GitHub Secrets Setup](../docs/GITHUB_SECRETS_SETUP.md)
- 🎯 [Copilot Instructions](../.github/copilot-instructions.md)
