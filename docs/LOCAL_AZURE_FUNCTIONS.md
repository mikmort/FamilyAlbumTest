# Local Azure Functions Development Guide

This guide explains how to run Azure Functions locally for end-to-end testing with GitHub Copilot and local development.

## Overview

The Family Album application uses:
- **Next.js** frontend on port 3000
- **Azure Functions** API on port 7071
- Next.js proxies `/api/*` requests to Azure Functions

For full end-to-end testing, both servers must be running.

## Prerequisites

### 1. Install Azure Functions Core Tools

Azure Functions Core Tools must be installed separately from npm. Choose your platform:

#### Windows

```powershell
# Using Chocolatey
choco install azure-functions-core-tools-4

# Or using npm (may require admin)
npm install -g azure-functions-core-tools@4 --unsafe-perm true
```

#### macOS

```bash
# Using Homebrew
brew tap azure/functions
brew install azure-functions-core-tools@4

# If upgrading
brew link --overwrite azure-functions-core-tools@4
```

#### Linux (Ubuntu/Debian)

```bash
# Add Microsoft package repository
wget -q https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb

# Install
sudo apt-get update
sudo apt-get install azure-functions-core-tools-4
```

#### Verify Installation

```bash
func --version
# Should output: 4.x.x
```

### 2. Configure Environment Variables

Run the setup script to create both `.env.local` and `api/local.settings.json`:

```bash
# Create .env.local for Next.js
npm run setup:env

# Create api/local.settings.json for Azure Functions
npm run setup:api-env
```

Or manually create `.env.local`:

```env
# Enable dev mode for testing
DEV_MODE=true
DEV_USER_EMAIL=dev@example.com
DEV_USER_ROLE=Admin

# Azure SQL Database (optional for basic testing)
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=your-username
AZURE_SQL_PASSWORD=your-password

# Azure Blob Storage (optional for basic testing)
AZURE_STORAGE_ACCOUNT=yourstorageaccount
AZURE_STORAGE_KEY=your-storage-key
AZURE_STORAGE_CONTAINER=family-album-media
```

The `setup:api-env` script will automatically create `api/local.settings.json` from your `.env.local` values.

## Running Locally

### Option 1: Run Full Stack (Recommended)

Start both Azure Functions and Next.js together:

```bash
npm run dev:full
```

This will:
1. Generate `api/local.settings.json` from environment
2. Start Azure Functions on http://localhost:7071
3. Start Next.js on http://localhost:3000
4. Next.js will proxy API calls to Azure Functions

### Option 2: Run Separately (For Debugging)

Start each server in separate terminal windows:

**Terminal 1 - Azure Functions API:**
```bash
npm run setup:api-env  # Generate local.settings.json
npm run dev:api        # Start Azure Functions
```

**Terminal 2 - Next.js Frontend:**
```bash
npm run dev:frontend   # Start Next.js
```

### Option 3: Run Tests (Automated)

The Playwright test suite will automatically start both servers:

```bash
npm run setup:env      # Create .env.local if needed
npm test               # Runs tests with both servers
```

## Development Workflow

### First Time Setup

```bash
# 1. Clone and install dependencies
git clone <repo>
cd FamilyAlbumTest
npm install
cd api && npm install && cd ..

# 2. Install Azure Functions Core Tools (see Prerequisites above)
func --version  # Verify installation

# 3. Configure environment
npm run setup:env
npm run setup:api-env

# 4. Start development
npm run dev:full
```

### Daily Development

```bash
# Start full stack
npm run dev:full

# In another terminal, run tests
npm test
```

### Testing Individual Components

```bash
# Test only API
npm run dev:api
curl http://localhost:7071/api/version

# Test only frontend
npm run dev:frontend
# Visit http://localhost:3000
```

## Verification

### Check Azure Functions is Running

```bash
# Check version endpoint
curl http://localhost:7071/api/version

# Check auth status (dev mode)
curl http://localhost:7071/api/auth-status
```

### Check Next.js Integration

```bash
# Next.js should proxy to Azure Functions
curl http://localhost:3000/api/version
curl http://localhost:3000/api/auth-status
```

Both should return the same response, confirming the proxy works.

## Troubleshooting

### "func: command not found"

**Problem**: Azure Functions Core Tools not installed.

**Solution**: Install using the instructions in Prerequisites section above.

### "Port 7071 already in use"

**Problem**: Another process is using the Azure Functions port.

**Solution**:
```bash
# Find and kill the process
lsof -ti:7071 | xargs kill -9

# Or use a different port in api/local.settings.json
"Host": {
  "LocalHttpPort": 7072
}
# Then update next.config.js rewrites to match
```

### "Cannot connect to database"

**Problem**: Database credentials not configured or incorrect.

**Solutions**:
1. **Use dev mode without database**: Some endpoints work without DB in dev mode
2. **Configure test database**: Set credentials in `.env.local`
3. **Check firewall**: Ensure your IP is allowed in Azure SQL firewall rules
4. **Check credentials**: Verify server name, database name, username, password

### "api/local.settings.json not found"

**Problem**: Configuration file not generated.

**Solution**:
```bash
npm run setup:api-env
```

### "Module not found" errors in API

**Problem**: API dependencies not installed.

**Solution**:
```bash
cd api
npm install
cd ..
```

### Tests fail with "getaddrinfo ENOTFOUND"

**Problem**: Tests are trying to connect to real Azure resources but can't resolve DNS.

**Solutions**:
1. **Use dev mode**: Ensure `DEV_MODE=true` in configuration
2. **Mock external dependencies**: Some tests can run without Azure resources
3. **Use test database**: Configure local or test Azure resources

## Architecture Notes

### Why Two Servers?

Azure Static Web Apps (production environment) runs:
- Static Next.js frontend (served as static files)
- Azure Functions API (serverless backend)

To match production locally, we run both servers.

### How API Proxying Works

1. Browser requests: `http://localhost:3000/api/people`
2. Next.js sees `/api/people` and checks `next.config.js` rewrites
3. Request is proxied to: `http://localhost:7071/api/people`
4. Azure Functions handles the request
5. Response flows back through Next.js to browser

### Dev Mode Authentication

When `DEV_MODE=true`:
- API endpoints bypass OAuth authentication
- Mock user is returned with configured email/role
- Allows testing without Azure AD or Google OAuth setup

**⚠️ Never use dev mode in production!**

## GitHub Copilot Usage

GitHub Copilot can now test the application end-to-end:

### Prerequisites for Copilot

1. **GitHub Secrets**: Configure in repository settings:
   - `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USER`, `AZURE_SQL_PASSWORD`
   - `AZURE_STORAGE_ACCOUNT`, `AZURE_STORAGE_KEY`, `AZURE_STORAGE_CONTAINER`

2. **Azure Functions Core Tools**: Must be installed in the CI environment

### Copilot Commands

```
# Setup and run tests
node scripts/setup-env.js && npm test

# Start development servers
npm run dev:full

# Test specific feature
npm run test:headed -- tests/media-gallery.spec.ts
```

Copilot will automatically:
1. Generate `.env.local` from GitHub Secrets
2. Generate `api/local.settings.json` from environment
3. Start both Azure Functions and Next.js
4. Run Playwright tests
5. Report results

## Advanced Configuration

### Custom API Port

Edit `api/local.settings.json`:

```json
{
  "Host": {
    "LocalHttpPort": 7072
  }
}
```

Then update `next.config.js`:

```javascript
async rewrites() {
  return [
    {
      source: '/api/:path*',
      destination: 'http://localhost:7072/api/:path*',
    },
  ];
}
```

### Multiple Environments

Create separate configuration files:

```bash
# Development
.env.local          -> api/local.settings.json

# Testing
.env.test           -> api/local.settings.test.json

# CI/CD
.env.ci             -> api/local.settings.ci.json
```

Use different npm scripts for each environment.

## Resources

- [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools)
- [Azure Functions Local Development](https://docs.microsoft.com/azure/azure-functions/functions-develop-local)
- [Next.js Rewrites](https://nextjs.org/docs/api-reference/next.config.js/rewrites)
- [Project Documentation](../README.md)
- [Dev Mode Testing Guide](./DEV_MODE_TESTING.md)

## Summary

**Quick Start:**
1. Install Azure Functions Core Tools globally
2. Run `npm run setup:env && npm run setup:api-env`
3. Run `npm run dev:full`
4. Visit http://localhost:3000

**For Tests:**
1. Run `npm run setup:env`
2. Run `npm test` (automatically starts both servers)

**For Production:**
- Azure Static Web Apps handles both frontend and API
- No local setup required
- Environment variables configured in Azure Portal
