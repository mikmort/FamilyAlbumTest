# Family Album Test Suite

This directory contains essential end-to-end tests for the Family Album web application using Playwright.

## Overview

The test suite is designed to work with the Family Album application in **dev mode**, which bypasses the OAuth authentication requirement. This allows developers and automated testing to run basic tests without setting up OAuth providers.

**Note**: The test suite has been intentionally kept minimal, focusing only on critical functionality:
- Basic navigation and authentication bypass in dev mode
- Core API endpoint availability

## Test Files

- `api-endpoints.spec.ts` - Tests core API endpoints (auth, people, events, media)
  - **Note**: These tests require Azure Functions Core Tools (`func`) to be installed
  - If `func` is not available, these tests are automatically skipped
- `homepage.spec.ts` - Tests homepage functionality with fallback API routes
- `navigation.spec.ts` - Tests basic page load and dev mode authentication bypass

## Architecture

The test suite uses a hybrid approach to support multiple environments:

### With Azure Functions (Full Testing)

When Azure Functions Core Tools (`func`) is installed:
- Both Next.js frontend and Azure Functions API start
- All tests run, including API endpoint tests
- Tests verify actual API behavior

### Without Azure Functions (Frontend Testing)

When Azure Functions Core Tools is not available (e.g., GitHub Copilot):
- Only Next.js frontend starts
- API endpoint tests are automatically skipped (8 tests)
- Homepage and navigation tests use fallback API routes (12 tests)
- Fallback routes provide mock data for frontend testing

### Fallback API Routes

The following Next.js API routes provide mock data when Azure Functions is unavailable:
- `/app/api/auth-status/route.ts` - Returns dev mode authentication
- `/app/api/db-warmup/route.ts` - No-op endpoint for database warmup
- `/app/api/new-media/route.ts` - Returns empty new media count
- `/app/api/homepage/route.ts` - Returns mock homepage statistics

Each fallback route:
1. First attempts to forward the request to Azure Functions (localhost:7071)
2. Falls back to mock data if Azure Functions is unavailable
3. Only works in dev mode for security

## Setup

### Prerequisites

- Node.js 18+
- All dependencies installed (`npm install`)
- Playwright browsers installed (`npx playwright install chromium`)
- *Optional*: Azure Functions Core Tools for full API testing

### Installation

**Basic Setup (Frontend Testing Only):**

```bash
npm install
npx playwright install chromium
```

**Full Setup (With Azure Functions):**

```bash
npm install
npx playwright install chromium

# Install Azure Functions Core Tools
# macOS (Homebrew):
brew install azure-functions-core-tools@4

# Windows (Chocolatey):
choco install azure-functions-core-tools-4

# Linux/WSL:
# See: https://docs.microsoft.com/azure/azure-functions/functions-run-local
```

### Quick Start

```bash
# Setup environment (creates .env.local with dev mode enabled)
npm run setup:env

# Run all tests
npm test
```

**Expected Results:**
- With Azure Functions: 20 tests (12 passed, 8 passed API tests)
- Without Azure Functions: 20 tests (12 passed, 8 skipped API tests)

### Configuration

Tests are configured to run with dev mode enabled automatically in `playwright.config.ts`.

**Dev Mode Environment Variables:**
- `DEV_MODE=true` - Bypasses authentication
- `DEV_USER_EMAIL=test@example.com` - Simulated user email
- `DEV_USER_ROLE=Admin` - Simulated user role

## Running Tests

### All Tests

```bash
npm test
```

### Headed Mode (See Browser)

```bash
npm run test:headed
```

### Debug Mode

```bash
npm run test:debug
```

### Specific Test File

```bash
npx playwright test tests/navigation.spec.ts
npx playwright test tests/api-endpoints.spec.ts
```

## Dev Mode Testing

### How It Works

1. When tests run, `playwright.config.ts` starts the dev server with `DEV_MODE=true`
2. The API's `checkAuthorization()` function in `/api/shared/auth.js` detects dev mode
3. Instead of checking OAuth authentication, it returns a mock user
4. Tests can interact with the API as if authenticated

### Security

**Dev mode is only for local development and testing:**
- Never deploy with `DEV_MODE=true` in production
- Production always requires real OAuth authentication
- API logs a warning when dev mode is active

## Testing with Database and Storage

Tests are designed to work with or without database/storage credentials:

- With credentials: Tests verify actual API responses
- Without credentials: Tests verify endpoint availability and error handling

To test with Azure resources, add credentials to `.env.local`:

```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=your-user
AZURE_SQL_PASSWORD=your-password
AZURE_STORAGE_ACCOUNT=your-account
AZURE_STORAGE_KEY=your-key
```

## Continuous Integration

Tests run automatically in GitHub Actions on push and pull requests.

See `.github/workflows/playwright.yml` for the CI configuration.

## Troubleshooting

### "Azure Functions Core Tools not available" message

**Message:**
```
[Playwright Config] Azure Functions Core Tools (func): ❌ Not Available
[Playwright Config] API server will be skipped. API endpoint tests will fail.
```

**This is expected behavior** if Azure Functions Core Tools is not installed.

**Impact:**
- 8 API endpoint tests will be skipped
- 12 frontend tests will pass using fallback API routes
- All tests should pass (no failures)

**To enable API tests:**
1. Install Azure Functions Core Tools (see Installation section)
2. Verify: `which func` (should show the path)
3. Re-run tests: `npm test`

### Tests Fail to Start

- Check that `npm run dev` works manually
- Verify port 3000 is not in use
- Ensure `.env.local` exists (run `npm run setup:env`)

### Homepage shows "Please Sign In"

- Verify `DEV_MODE=true` in `.env.local`
- Check that fallback API routes are being used
- Restart the dev server: stop tests and run `npm test` again

### All tests are skipped

- Check that Chromium browser is available: `which chromium-browser`
- Verify Playwright is installed: `npx playwright --version`
- Try installing browsers: `npx playwright install chromium`

### Authentication Errors

- Verify `DEV_MODE=true` in playwright.config.ts
- Check that auth.js has dev mode code
- Restart the test run

### Database Connection Errors

- Tests should work without database credentials (using fallback routes)
- If using Azure SQL, verify credentials and firewall rules
- Check that database is not paused (serverless tier)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
- [COPILOT_TESTING.md](../docs/COPILOT_TESTING.md) - Testing in GitHub Copilot environment
- [DEV_MODE_TESTING.md](../docs/DEV_MODE_TESTING.md) - Dev mode authentication
- [Azure Functions Core Tools](https://docs.microsoft.com/azure/azure-functions/functions-run-local) - Installing func CLI
