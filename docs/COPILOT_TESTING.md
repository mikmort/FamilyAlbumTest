# Playwright Testing in GitHub Copilot

This document explains how Playwright testing works in the GitHub Copilot coding agent environment.

## Overview

The Family Album application uses Playwright for end-to-end testing. However, GitHub Copilot's environment has limitations that prevent the standard Playwright browser installation from working. This guide explains how we've solved this problem.

## The Problem

When running Playwright tests in GitHub Copilot, the following issues occur:

1. **Browser Download Failures**: Playwright's automatic browser download fails due to network/size mismatch errors
2. **FFmpeg Missing**: Video recording requires ffmpeg which has similar installation issues
3. **Limited Browser Support**: Only Chromium is available as a system-installed browser

## The Solution

We've configured Playwright to automatically detect the GitHub Copilot environment and use the system-installed Chromium browser instead of trying to download its own browsers.

### Key Configuration Changes

In `playwright.config.ts`:

```typescript
// Detect Copilot environment using COPILOT_AGENT_ACTION env variable
projects: [
  {
    name: 'chromium',
    use: { 
      ...devices['Desktop Chrome'],
      // Use system browser in Copilot
      launchOptions: process.env.COPILOT_AGENT_ACTION ? {
        executablePath: '/usr/bin/chromium-browser',
      } : undefined,
    },
  },
  // Firefox and Webkit only run outside Copilot
  ...(process.env.COPILOT_AGENT_ACTION ? [] : [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ]),
]
```

### Video Recording

Video recording is disabled in Copilot environment:

```typescript
use: {
  // Disable video in Copilot (no ffmpeg available)
  video: process.env.COPILOT_AGENT_ACTION ? 'off' : 'retain-on-failure',
}
```

## How to Use

### In GitHub Copilot

Simply run tests as normal:

```bash
npm test
```

Or run specific tests:

```bash
npm test tests/navigation.spec.ts
```

The configuration automatically:
- Uses the system Chromium browser
- Disables video recording
- Runs only Chromium and Mobile Chrome projects
- Enables dev mode for authentication bypass

### In Local Development

No changes needed! The configuration detects you're not in Copilot and uses the standard Playwright setup:

```bash
# Install Playwright browsers once
npx playwright install

# Run tests with all browsers
npm test
```

### In CI/CD (GitHub Actions)

The existing `.github/workflows/playwright.yml` workflow continues to work as before:
- Installs Playwright browsers using the workflow
- Runs tests with full browser support
- Generates video recordings on failures

## Browser Support

| Environment | Chromium | Firefox | Webkit | Mobile Chrome | Mobile Safari |
|-------------|----------|---------|--------|---------------|---------------|
| **GitHub Copilot** | ✅ (system) | ❌ | ❌ | ✅ (system) | ❌ |
| **Local Dev** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **GitHub Actions** | ✅ | ✅ | ✅ | ✅ | ✅ |

## Features in Copilot

### What Works ✅

- **Navigation tests**: Full UI testing with Chromium
- **API tests**: Backend endpoint testing
- **Dev mode**: Authentication bypass works perfectly
- **Screenshots**: Captured on test failures
- **Traces**: Debug traces generated for failures
- **Mobile viewport**: Mobile Chrome tests work

### What's Limited ⚠️

- **Video recording**: Disabled (no ffmpeg)
- **Browser variety**: Only Chromium available
- **Database tests**: May fail without Azure credentials (expected)
- **Storage tests**: May fail without Azure credentials (expected)

## Environment Detection

The configuration detects GitHub Copilot using the `COPILOT_AGENT_ACTION` environment variable:

```typescript
if (process.env.COPILOT_AGENT_ACTION) {
  // Running in GitHub Copilot
  // Use system browser, disable video, limit projects
}
```

This variable is automatically set by GitHub Copilot and is not available in other environments.

## Troubleshooting

### Tests fail with "browser not found"

**Symptom**: Error about missing browser executable

**Solution**: The configuration should handle this automatically. If it doesn't:
1. Check that `COPILOT_AGENT_ACTION` env variable is set
2. Verify `/usr/bin/chromium-browser` exists
3. Try running: `which chromium-browser`

### Some tests fail

**Expected behavior** - Tests that require Azure database or storage will fail if credentials aren't configured:
- Auth status tests (need database)
- Media tests (need storage)
- User management tests (need database)

**Frontend tests should pass**:
- Navigation tests ✅
- UI component tests ✅
- Client-side functionality ✅

### Video/FFmpeg errors

This should be resolved by the configuration. If you still see ffmpeg errors:
1. Check that video is disabled: `video: 'off'`
2. Verify `COPILOT_AGENT_ACTION` is set
3. Try disabling video explicitly in test config

## Comparison with Standard Setup

### Standard Playwright Setup

```bash
# Install browsers (large download)
npx playwright install

# Run tests
npm test
```

### GitHub Copilot Setup

```bash
# No installation needed - uses system browser
npm test
```

## Benefits

1. **No Installation Required**: Skip the browser download step
2. **Faster Startup**: System browser is already available
3. **Automatic Detection**: Works without manual configuration
4. **Backwards Compatible**: Doesn't affect local dev or CI/CD
5. **Resource Efficient**: Uses existing system resources

## Technical Details

### System Browser Path

The system Chromium is installed at:
```
/usr/bin/chromium-browser → /usr/local/share/chromium/chrome-linux/chrome
```

### Environment Variables

Key environment variables in Copilot:
- `COPILOT_AGENT_ACTION`: Set to action type (e.g., 'fix')
- `CI`: Set to 'true'
- `GITHUB_ACTIONS`: Set to 'true'

### Browser Version

System Chromium version: **142.0.7444.0** (as of Nov 2024)

This is a recent version that supports all modern web features.

## Future Improvements

Potential enhancements:

1. **Add Firefox support**: If system Firefox becomes available
2. **Selective video recording**: Record only critical test failures
3. **Browser version detection**: Auto-select compatible features
4. **Mock data**: Provide mock data for tests without Azure credentials

## Related Documentation

- [DEV_MODE_TESTING.md](./DEV_MODE_TESTING.md) - How dev mode works
- [GITHUB_SECRETS_SETUP.md](./GITHUB_SECRETS_SETUP.md) - Setting up Azure credentials
- [TESTING_QUICK_START.md](../TESTING_QUICK_START.md) - Quick start guide
- [Playwright Config](../playwright.config.ts) - Configuration file

## Support

If you encounter issues:

1. Check this documentation
2. Review test output for specific errors
3. Verify environment variables: `printenv | grep COPILOT`
4. Check browser availability: `which chromium-browser`
5. Review configuration: `cat playwright.config.ts`

## Summary

✅ **Playwright testing now works seamlessly in GitHub Copilot**
- Uses system Chromium browser
- No installation required
- Automatic environment detection
- Backwards compatible with existing setups
- Fast and efficient test execution

The configuration changes are minimal and focused on making Playwright work in the constrained Copilot environment while maintaining full functionality in all other environments.
