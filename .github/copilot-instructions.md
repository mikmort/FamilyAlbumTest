# GitHub Copilot Instructions for Family Album Web Application

This document provides guidance for GitHub Copilot when working on the Family Album web application.

## Project Overview

This is a comprehensive family photo and video management web application built with:
- **Frontend**: Next.js 14 with TypeScript and React (static export)
- **API**: Azure Functions (Node.js 18) in the `/api` folder
- **Database**: Azure SQL Database with role-based access control (RBAC)
- **Storage**: Azure Blob Storage for media files and thumbnails
- **Hosting**: Azure Static Web Apps
- **Authentication**: Microsoft and Google OAuth via Azure Static Web Apps

## Project Structure

```
├── app/                    # Next.js app directory (pages and layouts)
├── api/                    # Azure Functions (serverless API)
│   ├── shared/            # Shared utilities (auth.js, db.js, storage.js)
│   ├── media/             # Media management endpoints
│   ├── people/            # People management endpoints
│   ├── events/            # Event management endpoints
│   ├── upload/            # Upload endpoints
│   └── users/             # User management (Admin only)
├── components/            # React components
├── lib/                   # Shared TypeScript utilities and types
├── database/              # SQL schema files
├── infrastructure/        # Bicep templates for Azure deployment
├── scripts/               # PowerShell deployment and migration scripts
├── docs/                  # Documentation files
└── tests/                 # Playwright tests (e2e)
```

## Core Concepts

### Authentication & Authorization

The app uses a role-based access control (RBAC) system with three roles:
- **Admin**: Full access + user management
- **Full**: Can view, upload, and edit media
- **Read**: Can only view media

Authentication is handled by Azure Static Web Apps (Microsoft/Google OAuth).
Authorization is implemented in `/api/shared/auth.js` with the `checkAuthorization` function.

**All API endpoints must check authorization** using:
```javascript
const { authorized, user, error } = await checkAuthorization(context, 'Read');
if (!authorized) {
  context.res = { status: 403, body: { error } };
  return;
}
```

### Dev Mode for Testing

When developing and testing with GitHub Copilot or Playwright, you can enable **Dev Mode** to bypass RBAC:

1. Run the setup script: `node scripts/setup-env.js` (automatically creates `.env.local` with dev mode)
2. Or manually set `DEV_MODE=true` in your `.env.local` file
3. Optionally set `DEV_USER_EMAIL` and `DEV_USER_ROLE` to simulate a specific user
4. Dev mode is automatically disabled in production

Dev mode allows automated testing without requiring actual OAuth authentication.

**For GitHub Copilot and Coding Agents:**
- Dev mode is pre-configured in `playwright.config.ts`
- GitHub Secrets are automatically available as environment variables
- Run `node scripts/setup-env.js` to create `.env.local` from secrets
- Tests can run with or without Azure credentials (limited functionality without)

See [docs/DEV_MODE_TESTING.md](docs/DEV_MODE_TESTING.md) and [docs/GITHUB_SECRETS_SETUP.md](docs/GITHUB_SECRETS_SETUP.md) for details.

**Local Development Note**: This application uses Azure Static Web Apps architecture where the API (Azure Functions) runs separately from the frontend (Next.js). For full local testing:
- Frontend: `npm run dev` (runs on port 3000)
- API: Requires Azure Functions Core Tools (`func start` in the `/api` directory)
- In production (Azure), both are automatically configured and integrated

### Database Schema

**⚠️ CRITICAL: Always check `/database/CURRENT_SCHEMA.md` before writing SQL queries or making schema changes!**

This file is auto-generated from the production Azure SQL database and represents the **authoritative source of truth** for the current database structure.

Main tables (see CURRENT_SCHEMA.md for complete, up-to-date details):
- **Users**: User accounts with roles and permissions
- **NameEvent**: People (neType='N') and events (neType='E')
- **Pictures**: Photos and videos with metadata
- **NamePhoto**: Many-to-many relationship between people/events and media
- **UnindexedFiles**: Staging area for newly uploaded files
- **FaceEmbeddings**: Face embeddings for AI recognition
- **FaceTrainingProgress**: Training session tracking
- **ApprovalTokens**: Email-based approval workflow
- **UserLastViewed**: User activity tracking

**When making schema changes:**
1. Create a migration script in `/database/`
2. Apply the change to the database
3. Regenerate documentation: `node scripts/get-schema.js > database/CURRENT_SCHEMA.md`
4. Commit both the migration script AND the updated CURRENT_SCHEMA.md
5. Update `/database/README.md` if adding new tables or major changes

Database connection is managed in `/api/shared/db.js`.

**Database Access for Coding Agents:**
- Database credentials are stored as GitHub repository secrets
- The `scripts/get-schema.js` script automatically uses GitHub secrets when available
- In coding agent sessions, environment variables are populated from GitHub secrets
- Local development uses `api/local.settings.json` as fallback
- Never commit database credentials to the repository

### Blob Storage

Media files are stored in Azure Blob Storage with this structure:
- Original files: `family-album-media` container
- Thumbnails: Auto-generated with `-thumb.jpg` suffix
- SAS tokens are generated for secure, temporary access

Storage utilities are in `/api/shared/storage.js`.

## Development Workflow

### Setup

```bash
# Install dependencies
npm install
cd api && npm install && cd ..

# Copy environment template
cp .env.local.template .env.local

# Edit .env.local with your Azure credentials
# For dev mode testing, add:
# DEV_MODE=true
# DEV_USER_EMAIL=test@example.com
# DEV_USER_ROLE=Full

# Setup Azure Functions configuration
npm run setup:api-env

# Run development server (Next.js only - API calls will fail)
npm run dev

# OR run full stack (Next.js + Azure Functions) - RECOMMENDED
npm run dev:full
```

**Note**: For full functionality, install [Azure Functions Core Tools](https://github.com/Azure/azure-functions-core-tools) and use `npm run dev:full`. See [docs/LOCAL_AZURE_FUNCTIONS.md](docs/LOCAL_AZURE_FUNCTIONS.md) for complete setup guide.

### Building and Linting

```bash
# Build the Next.js app
npm run build

# Run ESLint
npm run lint
```

### Testing with Playwright

```bash
# Install Playwright browsers
npx playwright install

# Run all tests
npm test

# Run tests in headed mode (see browser)
npm run test:headed

# Run specific test file
npx playwright test tests/media-gallery.spec.ts
```

Tests are configured to use dev mode automatically. See `playwright.config.ts` for configuration.

### Pull Request Requirements

When creating pull requests, follow these guidelines to ensure clear documentation of changes:

**Screenshots for UX Changes:**
- **Include screenshots when your changes affect the user interface or user experience AND can be validated with automated tests**
- Take screenshots showing:
  - The new or modified UI components
  - Before/after comparisons for UI updates (when applicable)
  - Different states of interactive elements (hover, active, disabled, etc.)
  - Mobile/responsive views if the change affects responsive behavior
- Place screenshots in the PR description to make visual changes immediately clear to reviewers
- Use descriptive captions for each screenshot explaining what is shown

**When screenshots are applicable:**
- New pages or views
- Modified layouts or styling
- New or updated React components with visual elements
- Changes to navigation, menus, or interactive controls
- Form updates or validation messages
- Modal dialogs, tooltips, or popups
- Icon or color scheme changes
- Responsive design adjustments

**When screenshots are NOT required:**
- API-only changes (backend logic, database queries)
- Configuration file updates
- Documentation-only changes
- Build script or tooling modifications
- Changes without visual impact

**How to capture screenshots:**
- **Only include screenshots if they can be captured in automated tests**
- Use Playwright to capture screenshots during test execution: `await page.screenshot({ path: 'feature.png' })`
- Do not create manual visualizations or mockups
- Screenshots should reflect the actual working product as validated by tests
- Include full-page screenshots for layout changes, or focused screenshots for component changes
- Ensure the test that captures the screenshot is included in the PR

## API Endpoints

### Authentication
- `GET /api/auth-status` - Check user authentication and authorization status

### User Management (Admin only)
- `GET /api/users` - List all users or pending requests
- `POST /api/users` - Add new user
- `PUT /api/users/:id` - Update user role/status
- `DELETE /api/users/:id` - Delete user

### People Management
- `GET /api/people` - Get all people or search by name
- `GET /api/people/[id]` - Get specific person
- `POST /api/people` - Create new person (requires Full role)
- `PUT /api/people/[id]` - Update person (requires Full role)
- `DELETE /api/people/[id]` - Delete person (requires Full role)

### Event Management
- `GET /api/events` - Get all events or search by name
- `GET /api/events/[id]` - Get specific event
- `POST /api/events` - Create new event (requires Full role)
- `PUT /api/events/[id]` - Update event (requires Full role)
- `DELETE /api/events/[id]` - Delete event (requires Full role)

### Media Management
- `GET /api/media` - Get media items with filtering
- `GET /api/media/[filename]` - Get specific media item with details
- `PUT /api/media/[filename]` - Update media metadata (requires Full role)
- `DELETE /api/media/[filename]` - Delete media item (requires Full role)
- `GET /api/getUploadUrl` - Get SAS URL for upload (requires Full role)
- `POST /api/uploadComplete` - Mark upload as complete (requires Full role)

### File Processing
- `GET /api/unindexed` - Get list of unindexed files
- `POST /api/unindexed/process` - Process unindexed file (requires Full role)

## Code Style and Best Practices

### TypeScript/JavaScript
- Use TypeScript for all new frontend code
- Use JSDoc comments for JavaScript files in `/api`
- Follow existing code style (see `.eslintrc.json`)
- Use async/await instead of promises
- Always handle errors gracefully

### React Components
- Use functional components with hooks
- Keep components focused and single-purpose
- Use proper TypeScript types from `/lib/types.ts`
- Follow the existing component structure in `/components`

### API Functions
- Always check authorization first using `checkAuthorization()`
- Use parameterized queries to prevent SQL injection
- Return consistent error responses: `{ error: "message" }`
- Log errors with `context.log.error()`
- Handle database connection errors gracefully

### Database Queries
- **ALWAYS check `/database/CURRENT_SCHEMA.md` before writing SQL queries**
- Always use parameterized queries via the `query()` function
- Never concatenate user input into SQL strings
- Use transactions for multi-step operations
- Consider performance for large datasets
- Test queries against actual database schema, not assumptions

### Database Schema Changes
When modifying the database schema:
1. Create a migration script in `/database/` with a descriptive name
2. Test the migration on development database first
3. Apply the migration to production database
4. **Immediately regenerate schema documentation:**
   ```bash
   node scripts/get-schema.js > database/CURRENT_SCHEMA.md
   ```
5. Commit both the migration script AND updated CURRENT_SCHEMA.md:
   ```bash
   git add database/your-migration.sql database/CURRENT_SCHEMA.md
   git commit -m "Add [feature]: schema change and regenerate docs"
   ```
6. Update `/database/README.md` if adding new tables or major structural changes
7. Update TypeScript types in `/lib/types.ts` to match new schema

### Error Handling
- Return appropriate HTTP status codes (200, 400, 401, 403, 404, 500)
- Provide clear error messages for clients
- Log detailed errors server-side
- Never expose sensitive information in error messages

## Testing Guidelines

### Playwright Tests
- Place tests in `/tests` directory
- Use `.spec.ts` extension for test files
- Tests run with dev mode enabled automatically
- Mock or use test data for database operations
- Clean up test data after each test

### Test Structure
```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test('should do something', async ({ page }) => {
    await page.goto('http://localhost:3000');
    // Test code here
  });
});
```

### Navigation Testing
- Test the main navigation flow: Select → Gallery → Detail
- Verify all filters work (people, events, untagged)
- Test media detail modal functionality
- Verify upload and editing flows (Full role)
- Test admin settings (Admin role)

## Common Tasks

### Adding a New API Endpoint
1. Create new folder in `/api` (e.g., `/api/my-endpoint`)
2. Add `index.js` with handler function
3. Import and use `checkAuthorization()` from `/api/shared/auth.js`
4. Import `query()` from `/api/shared/db.js` for database access
5. Test endpoint with Playwright or manually

### Adding a New React Component
1. Create component in `/components` directory
2. Define TypeScript types from `/lib/types.ts` or add new types
3. Follow existing component patterns (props, state, effects)
4. Import and use in parent component
5. Add to relevant pages in `/app`

### Modifying Database Schema
1. Update schema files in `/database` directory
2. Create migration script if needed
3. Test migration on development database
4. Update TypeScript types in `/lib/types.ts`
5. Update API endpoints to use new schema

### Adding Tests
1. Create test file in `/tests` directory
2. Use dev mode for testing (configured by default)
3. Follow existing test patterns
4. Run tests locally before committing
5. Ensure tests clean up after themselves

## Security Considerations

1. **Never commit secrets** - Use environment variables for all credentials
2. **Always validate input** - Check all user inputs before processing
3. **Use parameterized queries** - Prevent SQL injection attacks
4. **Check authorization** - Verify user permissions for all operations
5. **Generate SAS tokens** - Don't expose storage keys to clients
6. **Sanitize error messages** - Don't leak sensitive information
7. **Use HTTPS** - Enforce HTTPS in production (automatic with Azure)

## Troubleshooting

### Database Connection Issues
- Check environment variables in `.env.local`
- Verify firewall rules allow your IP
- Ensure database is not paused (serverless tier)
- Check SQL credentials are correct

### Authentication Issues
- Verify `staticwebapp.config.json` is correct
- Check Azure AD/Google OAuth app configuration
- Ensure user exists in Users table with Active status
- Clear browser cache and cookies

### Storage Issues
- Verify storage account credentials
- Check container name is correct
- Ensure SAS tokens are not expired
- Verify blob names don't contain invalid characters

### Dev Mode Not Working
- Ensure `DEV_MODE=true` in `.env.local`
- Restart development server after changing env vars
- Check `process.env.DEV_MODE` is being read correctly
- Verify auth.js is checking dev mode correctly

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Azure Functions Documentation](https://docs.microsoft.com/azure/azure-functions/)
- [Azure SQL Documentation](https://docs.microsoft.com/azure/sql-database/)
- [Azure Blob Storage Documentation](https://docs.microsoft.com/azure/storage/blobs/)
- [Playwright Documentation](https://playwright.dev/)

## Key Documentation Files

- `README.md` - Project overview and quick start
- `RBAC_DEPLOYMENT_CHECKLIST.md` - RBAC system deployment guide
- `docs/RBAC_SYSTEM.md` - Detailed RBAC documentation
- `docs/AUTHENTICATION_SETUP.md` - OAuth setup instructions
- `docs/AZURE_SETUP.md` - Azure resource configuration
- `scripts/README.md` - PowerShell deployment scripts
