# Family Album Test Suite

This directory contains end-to-end tests for the Family Album web application using Playwright.

## Overview

The test suite is designed to work with the Family Album application in **dev mode**, which bypasses the OAuth authentication requirement. This allows GitHub Copilot and developers to run automated tests without setting up OAuth providers.

## Setup

### Prerequisites

- Node.js 18+
- All dependencies installed (`npm install`)
- Local development server can start successfully

### Installation

Playwright browsers are installed automatically when you run tests for the first time, but you can install them manually:

```bash
npx playwright install
```

**Note**: If Playwright browser installation fails (common in CI or restricted environments), you can use the simple verification script:

```bash
# Start dev server in one terminal
npm run dev

# Run verification in another terminal (requires Azure Functions Core Tools)
node tests/verify-dev-mode.js
```

**Important**: The verification script requires both the Next.js dev server AND Azure Functions Core Tools to be running for the API endpoints. In production environments (Azure Static Web Apps), the API is automatically available. For full local testing:

1. Install Azure Functions Core Tools: https://docs.microsoft.com/azure/azure-functions/functions-run-local
2. Start the Azure Functions: `cd api && func start`
3. Start Next.js: `npm run dev`
4. Run tests: `npm test`

### Configuration

Tests are configured to run with dev mode enabled automatically. The configuration is in `playwright.config.ts`.

**Dev Mode Environment Variables:**
- `DEV_MODE=true` - Bypasses authentication
- `DEV_USER_EMAIL=test@example.com` - Simulated user email
- `DEV_USER_ROLE=Admin` - Simulated user role (Admin, Full, or Read)

These are set automatically in the Playwright configuration when running tests.

## Running Tests

### All Tests

```bash
npm test
```

### Headed Mode (See Browser)

```bash
npm run test:headed
```

### Debug Mode (Step Through Tests)

```bash
npm run test:debug
```

### UI Mode (Interactive Test Runner)

```bash
npm run test:ui
```

### Specific Test File

```bash
npx playwright test tests/navigation.spec.ts
```

### Specific Browser

```bash
npx playwright test --project=chromium
```

## Test Structure

### navigation.spec.ts

Tests basic navigation and dev mode authentication bypass:
- Home page loads correctly
- UI elements are visible
- Navigation between views works
- Dev mode bypasses authentication

### api-endpoints.spec.ts

Tests API endpoints with dev mode:
- Auth status endpoint
- People, events, and media listing
- Admin endpoints
- Authorization headers

### media-gallery.spec.ts

Tests the media gallery functionality:
- People selector view
- Navigation buttons
- Filtering by people
- Gallery view with thumbnails
- Media detail modal
- Sorting controls

## Dev Mode Testing

### How It Works

1. When tests run, the `playwright.config.ts` starts the dev server with `DEV_MODE=true`
2. The API's `checkAuthorization()` function in `/api/shared/auth.js` detects dev mode
3. Instead of checking OAuth authentication, it returns a mock user
4. Tests can now interact with the API as if authenticated

### Benefits

- No need to set up OAuth providers for testing
- GitHub Copilot can run tests automatically
- Faster test execution
- Consistent test environment

### Security

**Dev mode is only for local development and testing:**
- Never deploy with `DEV_MODE=true` in production
- Azure Static Web Apps environment doesn't include this variable
- Production always requires real OAuth authentication
- API logs a warning when dev mode is active

## Testing with Database and Storage

### Option 1: Test Database (Recommended)

Create a separate Azure SQL database for testing:

1. Create test database in Azure Portal
2. Run schema scripts from `/database` directory
3. Add test data (optional)
4. Update `.env.local` with test database credentials when running tests manually

```env
# Test Database
AZURE_SQL_SERVER=test-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum-Test
AZURE_SQL_USER=testuser
AZURE_SQL_PASSWORD=testpassword
```

### Option 2: Shared Development Database

Use the same database as development:
- Tests will use real data
- Be careful with write operations
- Clean up test data after tests

### Option 3: Mock Data

For unit tests or isolated component tests:
- Mock API responses
- Use test fixtures
- Don't require database connection

### Blob Storage Testing

Blob storage is required for media tests:

1. **Use test container**: Create a separate blob container for tests
2. **Use dev storage**: Use Azurite (Azure Storage Emulator) for local testing
3. **Mock storage**: Mock blob operations for unit tests

```bash
# Install Azurite for local storage emulation
npm install -g azurite

# Start Azurite
azurite --silent --location /tmp/azurite --debug /tmp/azurite/debug.log
```

Update `.env.local` for Azurite:
```env
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true
```

## Writing New Tests

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    // Navigate to page
    await page.goto('/');
    
    // Wait for content
    await page.waitForLoadState('networkidle');
    
    // Interact with page
    await page.click('button');
    
    // Assert results
    await expect(page.locator('h1')).toContainText('Expected Text');
  });
});
```

### API Testing

```typescript
import { test, expect } from '@playwright/test';

test('should call API endpoint', async ({ request }) => {
  const response = await request.get('/api/people');
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  expect(Array.isArray(data)).toBe(true);
});
```

### Best Practices

1. **Use dev mode**: Tests should work with `DEV_MODE=true`
2. **Wait for content**: Use `waitForLoadState()` or `waitForSelector()`
3. **Clean up**: Remove test data after each test
4. **Isolate tests**: Each test should be independent
5. **Use selectors**: Prefer data-testid or accessible selectors
6. **Handle empty state**: Tests should work with empty databases

## Continuous Integration

Tests can run in CI/CD pipelines:

### GitHub Actions Example

```yaml
name: Playwright Tests
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
      - name: Install Playwright Browsers
        run: npx playwright install --with-deps
      - name: Run Playwright tests
        run: npm test
        env:
          DEV_MODE: true
          DEV_USER_EMAIL: test@example.com
          DEV_USER_ROLE: Admin
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
```

## Troubleshooting

### Tests Fail to Start

**Problem**: Dev server doesn't start
**Solution**: 
- Check that `npm run dev` works manually
- Verify environment variables in `.env.local`
- Check port 3000 is not in use

### Authentication Errors

**Problem**: Tests get 401/403 errors
**Solution**:
- Verify `DEV_MODE=true` in playwright.config.ts
- Check that auth.js has dev mode code
- Restart the test run

### Database Connection Errors

**Problem**: API returns 500 errors
**Solution**:
- Verify database credentials in `.env.local`
- Check database firewall allows your IP
- Ensure database is not paused (serverless tier)

### No Media Appears

**Problem**: Gallery shows no images
**Solution**:
- Add test media to the database and blob storage
- Or test with empty state handling
- Verify blob storage connection string

### Slow Tests

**Problem**: Tests take too long
**Solution**:
- Use `--project=chromium` to test one browser
- Run tests in parallel with `--workers=4`
- Reduce `waitForTimeout()` values
- Mock API responses for faster tests

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Writing Tests](https://playwright.dev/docs/writing-tests)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [CI Configuration](https://playwright.dev/docs/ci)

## GitHub Copilot Integration

When GitHub Copilot runs tests:

1. It reads the Copilot instructions from `.github/copilot-instructions.md`
2. It starts the dev server with dev mode enabled
3. It runs the test suite automatically
4. It can navigate the app in a real browser to verify functionality

**To test with GitHub Copilot:**

Simply ask:
- "Run the test suite"
- "Test the media gallery"
- "Navigate to the app and test the people selector"
- "Verify the upload functionality works"

Copilot will use dev mode to bypass authentication and test the functionality.
