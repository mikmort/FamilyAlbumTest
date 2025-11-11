# Quick Start: Running Azure Functions Locally

## For GitHub Copilot and Coding Agents

This guide helps you quickly set up local Azure Functions for testing.

## Prerequisites Check

1. **Azure Functions Core Tools installed?**
   ```bash
   func --version
   ```
   
   If not installed, see [Installation Guide](LOCAL_AZURE_FUNCTIONS.md#prerequisites)

2. **Dependencies installed?**
   ```bash
   npm install
   cd api && npm install && cd ..
   ```

## Quick Setup (3 commands)

```bash
# 1. Generate .env.local
npm run setup:env

# 2. Generate api/local.settings.json
npm run setup:api-env

# 3. Start full stack (API + Frontend)
npm run dev:full
```

That's it! Visit http://localhost:3000

## Running Tests

```bash
# Tests automatically start both servers
npm test

# Run tests with visible browser
npm run test:headed

# Run specific test
npx playwright test tests/navigation.spec.ts
```

## Individual Server Commands

```bash
# Start Azure Functions only (port 7071)
npm run dev:api

# Start Next.js only (port 3000)
npm run dev:frontend

# Start both with concurrently
npm run dev:full
```

## Verify Setup

```bash
# Check API is running
curl http://localhost:7071/api/version

# Check Next.js proxy works
curl http://localhost:3000/api/version
```

## Troubleshooting

### "func: command not found"
Install Azure Functions Core Tools: [Installation Guide](LOCAL_AZURE_FUNCTIONS.md#prerequisites)

### "Port already in use"
Kill existing processes:
```bash
lsof -ti:7071 | xargs kill -9
lsof -ti:3000 | xargs kill -9
```

### API calls return errors
Check configuration:
```bash
cat api/local.settings.json
# Verify DEV_MODE is true
```

## GitHub Actions / CI Setup

For CI environments, Azure Functions Core Tools must be installed in the workflow:

```yaml
- name: Install Azure Functions Core Tools
  run: npm install -g azure-functions-core-tools@4 --unsafe-perm true
  
- name: Setup environment
  run: |
    npm run setup:env
    npm run setup:api-env
  env:
    AZURE_SQL_SERVER: ${{ secrets.AZURE_SQL_SERVER }}
    # ... other secrets
    
- name: Run tests
  run: npm test
```

## More Information

- [Complete Setup Guide](LOCAL_AZURE_FUNCTIONS.md)
- [Dev Mode Testing](DEV_MODE_TESTING.md)
- [Main README](../README.md)
