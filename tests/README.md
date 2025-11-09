# Family Album Test Suite

This directory contains essential end-to-end tests for the Family Album web application using Playwright.

## Overview

The test suite is designed to work with the Family Album application in **dev mode**, which bypasses the OAuth authentication requirement. This allows developers and automated testing to run basic tests without setting up OAuth providers.

**Note**: The test suite has been intentionally kept minimal, focusing only on critical functionality:
- Basic navigation and authentication bypass in dev mode
- Core API endpoint availability

## Test Files

- `api-endpoints.spec.ts` - Tests core API endpoints (auth, people, events, media)
- `navigation.spec.ts` - Tests basic page load and dev mode authentication bypass

## Setup

### Prerequisites

- Node.js 18+
- All dependencies installed (`npm install`)
- Playwright browsers installed (`npx playwright install chromium`)

### Installation

```bash
npm install
npx playwright install chromium
```

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

### Tests Fail to Start

- Check that `npm run dev` works manually
- Verify port 3000 is not in use
- Ensure `.env.local` has required variables if testing with Azure resources

### Authentication Errors

- Verify `DEV_MODE=true` in playwright.config.ts
- Check that auth.js has dev mode code
- Restart the test run

### Database Connection Errors

- Tests should work without database credentials
- If using Azure SQL, verify credentials and firewall rules
- Check that database is not paused (serverless tier)

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
