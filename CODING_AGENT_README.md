# GitHub Coding Agent - Ready to Use! 🚀

This repository is fully configured for GitHub Coding Agent development and testing.

## Quick Start (One Command)

```bash
npm run setup:agent
```

This command will:
- ✅ Check your environment (Azure Functions, network access)
- ✅ Create `.env.local` with dev mode enabled
- ✅ Create `api/local.settings.json` for Azure Functions
- ✅ Tell you exactly what you can do next

## What's Working

### Dev Mode ✅
- **Authentication bypass** fully functional
- No OAuth required for development/testing
- Mock Admin user configured
- Safe: only works with `DEV_MODE=true` environment variable

### Build & Development ✅
```bash
npm run build    # ✅ Works perfectly
npm run lint     # ✅ Passes (only warnings)
npm run dev      # ✅ Frontend development
```

### Azure Functions Core Tools ✅
- Installed: v4.4.0
- Installation script available for other environments
- Can start (if network permits cdn.functions.azure.com)

## Current Status

| Feature | Status | Notes |
|---------|--------|-------|
| Dev Mode | ✅ Working | Authentication bypass active |
| Setup Scripts | ✅ Working | Automated configuration |
| Build Process | ✅ Working | Production builds succeed |
| Linting | ✅ Working | Only style warnings |
| Frontend Dev | ✅ Working | Next.js dev server |
| Azure Functions | ⚠️ Limited | Needs cdn.functions.azure.com access |
| SQL Database | ⚠️ Not configured | GitHub secrets not injected |
| Blob Storage | ⚠️ Not configured | GitHub secrets not injected |
| Tests | ⚠️ Limited | Use SKIP_API_SERVER=true |

## Usage Scenarios

### Scenario 1: Frontend Development
Perfect for UI/UX work, component updates, styling:
```bash
npm run setup:agent
npm run dev
# Visit http://localhost:3000
```

### Scenario 2: Build & Deploy
Build production bundle:
```bash
npm run setup:agent
npm run build
# Static files in .next/ directory
```

### Scenario 3: Code Review & Linting
Check code quality:
```bash
npm run lint
# Shows only minor warnings
```

### Scenario 4: Testing (Limited)
Run tests without API:
```bash
npm run setup:agent
SKIP_API_SERVER=true npm test
# Frontend tests work, API tests may fail
```

## Network Restrictions

The coding agent environment has limited network access:

**Available:**
- ✅ npm registry
- ✅ GitHub
- ✅ localhost

**Restricted:**
- ❌ cdn.functions.azure.com (Azure Functions extension bundles)

**Workaround:**
Use `SKIP_API_SERVER=true` to skip Azure Functions startup in tests.

## File Structure

```
├── .env.local                      # ✅ Auto-generated dev mode config
├── api/
│   ├── local.settings.json         # ✅ Auto-generated API config
│   └── shared/
│       └── auth.js                 # Dev mode logic
├── scripts/
│   ├── setup-coding-agent.js      # Main setup script
│   ├── setup-env.js               # Create .env.local
│   ├── setup-api-env.js           # Create API settings
│   └── install-azure-functions.sh # Install Azure Functions
└── docs/
    ├── DEV_MODE_TESTING.md        # Dev mode documentation
    ├── CODING_AGENT_QUICKSTART.md # Quick reference
    └── GITHUB_SECRETS_SETUP.md    # Credentials setup
```

## Environment Variables

### Always Set (by setup:agent)
```env
DEV_MODE=true                    # Authentication bypass
DEV_USER_EMAIL=dev@example.com   # Mock user
DEV_USER_ROLE=Admin             # Full permissions
```

### Optional (from GitHub Secrets)
```env
# Not currently injected in coding agent environment
AZURE_SQL_SERVER=...
AZURE_SQL_DATABASE=...
AZURE_SQL_USER=...
AZURE_SQL_PASSWORD=...
AZURE_STORAGE_ACCOUNT=...
AZURE_STORAGE_KEY=...
AZURE_STORAGE_CONTAINER=...
```

## Commands Reference

| Command | Purpose | Status |
|---------|---------|--------|
| `npm run setup:agent` | Complete environment setup | ✅ Works |
| `npm run dev` | Start frontend only | ✅ Works |
| `npm run dev:full` | Start API + frontend | ⚠️ Needs network |
| `npm run build` | Build production | ✅ Works |
| `npm run lint` | Check code style | ✅ Works |
| `npm test` | Run all tests | ⚠️ Needs API or SKIP_API_SERVER |
| `SKIP_API_SERVER=true npm test` | Run frontend tests | ✅ Works |

## Troubleshooting

### "Cannot download extension bundles"
**Cause**: Network restrictions prevent cdn.functions.azure.com access

**Solution**: Use `SKIP_API_SERVER=true` for tests or work on frontend only

### "Database connection failed"
**Cause**: Azure SQL credentials not available

**Solution**: This is expected. The app works in dev mode without database (limited features)

### "Storage authentication failed"
**Cause**: Azure Storage credentials not available

**Solution**: This is expected. Media features won't work but dev mode still functions

## Security

✅ **Safe Configuration**
- Dev mode requires explicit `DEV_MODE=true`
- Not enabled in production (Azure Static Web Apps)
- `.env.local` never committed (in .gitignore)
- Mock user only for development/testing

✅ **No Secrets in Code**
- No credentials committed to repository
- GitHub secrets not accessible (by design)
- Safe to share and review code

## What You Can Do

### ✅ Can Do (Right Now)
- Frontend development
- Component updates
- Styling changes
- Build production bundle
- Code review
- Documentation updates
- Linting

### ⚠️ Limited (Due to Environment)
- Full stack testing (API + Frontend)
- Database operations
- File uploads/downloads
- Email notifications

### ❌ Cannot Do (Environment Restrictions)
- Start Azure Functions (needs network access)
- Access production database (no credentials)
- Access production storage (no credentials)

## Next Steps

1. Run `npm run setup:agent` to see current environment status
2. Choose appropriate workflow based on output
3. See `DEV_MODE_SETUP_STATUS.md` for detailed status
4. See `docs/CODING_AGENT_QUICKSTART.md` for comprehensive guide

## Need Help?

- 📖 Full documentation: `docs/CODING_AGENT_QUICKSTART.md`
- 🔧 Setup status: `DEV_MODE_SETUP_STATUS.md`
- 🎯 Dev mode details: `docs/DEV_MODE_TESTING.md`
- 🔐 Credentials guide: `docs/GITHUB_SECRETS_SETUP.md`

---

**Ready to start?** Run:
```bash
npm run setup:agent
```
