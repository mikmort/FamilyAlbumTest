# Testing Quick Start - For Coding Agents

This is the **fastest way** to get started with testing the Family Album application.

## One-Line Setup

```bash
npm run test:setup
```

This command:
1. Creates `.env.local` with dev mode enabled
2. Reads GitHub Secrets (if available)
3. Runs the complete Playwright test suite

## What You Need to Know

### ✅ Dev Mode is Already Configured
- Authentication bypass is implemented
- Tests work without OAuth setup
- Configured in `playwright.config.ts`

### ✅ Tests Can Run Without Azure Credentials
- Frontend tests work fine
- Some tests may fail without database/storage
- This is expected and OK for initial testing

### ✅ GitHub Secrets are Optional
- Add them for full test coverage
- See `docs/SECRETS_QUICK_SETUP.md` for 5-minute setup
- Or run without them for basic testing

## Common Commands

```bash
# Setup and test (recommended)
npm run test:setup

# Just setup environment
npm run setup:env

# Run tests
npm test

# Run with browser visible
npm run test:headed

# Debug specific test
npx playwright test tests/navigation.spec.ts --debug

# Start dev server
npm run dev
```

## Test Files

Located in `/tests/`:
- `navigation.spec.ts` - Basic navigation (works without Azure)
- `api-endpoints.spec.ts` - API testing (needs database)
- `media-gallery.spec.ts` - Media functionality (needs storage)
- `admin-features.spec.ts` - Admin features (needs database)

## Expected Behavior

### Without GitHub Secrets
✅ Dev mode works  
✅ Frontend tests pass  
❌ Database tests may fail  
❌ Storage tests may fail  

### With GitHub Secrets
✅ Dev mode works  
✅ Frontend tests pass  
✅ Database tests pass  
✅ Storage tests pass  

## Troubleshooting

**Error: "Playwright not found"**
```bash
npx playwright install chromium
```

**Error: "Server not running"**
- Tests automatically start server
- Wait 2 minutes for startup
- Or start manually: `npm run dev`

**Error: "Database connection failed"**
- This is expected without GitHub Secrets
- Frontend tests still work
- Add secrets for full testing

## More Documentation

- **Quick Setup**: `docs/SECRETS_QUICK_SETUP.md` (5 minutes)
- **Complete Guide**: `docs/GITHUB_SECRETS_SETUP.md` (comprehensive)
- **Dev Mode**: `docs/DEV_MODE_TESTING.md` (how dev mode works)
- **Coding Agents**: `docs/CODING_AGENT_QUICKSTART.md` (detailed guide)
- **Test Suite**: `tests/README.md` (test documentation)

## Success Criteria

After running `npm run test:setup`, you should see:

1. ✅ `.env.local` created with `DEV_MODE=true`
2. ✅ Some tests pass (navigation, frontend)
3. ⚠️ Some tests may fail (if no Azure credentials)
4. 📊 Test report generated in `playwright-report/`

This is **expected behavior** and means the setup is working correctly!
