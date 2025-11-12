# Testing Guide

## Quick Start - Run Tests WITHOUT Azure Functions API

If you don't have Azure Functions Core Tools installed, you can run frontend-only tests:

### PowerShell (Windows)
```powershell
$env:SKIP_API_SERVER='true'; npm test
```

### Bash (Linux/Mac)
```bash
SKIP_API_SERVER=true npm test
```

**Note:** With `SKIP_API_SERVER=true`, tests that require API functionality may fail, but UI/navigation tests should pass.

---

## Full Stack Testing WITH Azure Functions API

To test the complete application including API endpoints:

### 1. Install Azure Functions Core Tools

#### Windows (PowerShell as Administrator):
```powershell
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

Or use Chocolatey:
```powershell
choco install azure-functions-core-tools
```

Or use MSI installer from: https://github.com/Azure/azure-functions-core-tools/releases

#### Linux:
```bash
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

Or use package manager:
```bash
# Ubuntu/Debian
curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg
sudo mv microsoft.gpg /etc/apt/trusted.gpg.d/microsoft.gpg
sudo sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" > /etc/apt/sources.list.d/dotnetdev.list'
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

#### Mac:
```bash
brew tap azure/functions
brew install azure-functions-core-tools@4
```

### 2. Setup API Configuration

```bash
# Copy API environment template
cp api/local.settings.json.template api/local.settings.json

# Or run setup script
npm run setup:api-env
```

Edit `api/local.settings.json` with your Azure credentials (see `.env.local.template` for required values).

### 3. Install API Dependencies

```bash
cd api
npm install
cd ..
```

### 4. Run Full Stack Tests

```bash
npm test
```

This will:
1. Start Azure Functions API on port 7071
2. Start Next.js frontend on port 3000
3. Run Playwright tests
4. Clean up servers when done

---

## Test in Dev Mode (No Authentication Required)

Tests automatically run in dev mode with these settings:
- `DEV_MODE=true`
- `DEV_USER_EMAIL=test@example.com`
- `DEV_USER_ROLE=Admin`

This bypasses OAuth authentication for testing.

---

## Run Specific Tests

```bash
# Run a specific test file
npx playwright test tests/navigation.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run tests in debug mode
npx playwright test --debug
```

---

## Troubleshooting

### Error: "func: not found"
- Azure Functions Core Tools not installed
- Solution: Install as shown above OR run with `SKIP_API_SERVER=true`

### Error: "Module not found: Can't resolve 'swr'"
- Missing dependencies
- Solution: Run `npm install` in project root

### Error: Port 3000 or 7071 already in use
- Another process using the port
- Solution: Stop other dev servers or use `reuseExistingServer: true`

### Tests timing out
- Increase timeout in `playwright.config.ts`
- Check if servers started successfully (look for errors in console)

---

## CI/CD Testing

In GitHub Actions, tests run with:
- `SKIP_API_SERVER=true` (frontend-only)
- Or against deployed production URL using `PRODUCTION_URL` env var

See `.github/workflows/playwright.yml` for CI configuration.
