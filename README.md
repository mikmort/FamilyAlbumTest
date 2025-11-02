# Family Album Web Application
<!-- Trigger redeployment: trivial change -->

A comprehensive family photo and video management web application built with Next.js, TypeScript, Azure SQL Database, and Azure Blob Storage.

## 📁 Project Structure

```
├── app/                    # Next.js app directory (pages and layouts)
├── api/                    # Azure Functions (serverless API)
├── components/             # React components
├── infrastructure/         # Bicep templates for Azure deployment
├── database/              # SQL schema files
├── scripts/               # PowerShell deployment and migration scripts
├── docs/                  # Documentation files
└── lib/                   # Shared TypeScript utilities and types
```

## Features

- **Media Management**: Upload, organize, and manage family photos and videos
- **People Tagging**: Tag people in photos and videos with relationships
- **Event Management**: Associate media with family events (weddings, reunions, etc.)
- **Advanced Filtering**: Browse photos by people (OR/AND logic), events, or untagged media
- **Rich Metadata**: Add descriptions, dates, and embedded metadata to media files
- **Thumbnail Gallery**: Fast browsing with auto-generated thumbnails
- **Detail View**: Full-screen media viewing with complete metadata display
- **Cost-Effective**: Built on Azure serverless infrastructure to minimize costs

## Architecture

- **Frontend**: Next.js 14 with TypeScript and React
- **API**: Next.js API Routes (serverless functions)
- **Database**: Azure SQL Database (Serverless tier for cost savings)
- **Storage**: Azure Blob Storage for media files and thumbnails
- **Hosting**: Azure Static Web Apps (free tier available)

## Prerequisites

- Node.js 18+ and npm
- Azure Subscription
- Git

## 🚀 Quick Start

### Automated Deployment (Recommended)

Use the PowerShell scripts for automated deployment:

```powershell
# 1. Deploy Azure infrastructure
.\scripts\deploy.ps1

# 2. Initialize database schema
.\scripts\setup-database.ps1

# 3. Configure GitHub integration
.\scripts\setup-github-azure.ps1

# 4. (Optional) Migrate existing SQLite data
.\scripts\migrate-sqlite-v4.ps1 -SqliteDbPath "C:\path\to\database.db"
```

See [scripts/README.md](scripts/README.md) for detailed script documentation.

### Manual Setup

See [QUICKSTART.md](QUICKSTART.md) for a complete step-by-step guide.

Additional documentation in the `docs/` folder:
- [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md) - Azure resources configuration
- [docs/BICEP_SETUP.md](docs/BICEP_SETUP.md) - Infrastructure as Code setup
- [docs/SETUP_CHECKLIST.md](docs/SETUP_CHECKLIST.md) - Complete checklist

## Local Development Setup

### 1. Clone and Install Dependencies

```bash
cd FamilyAlbumTest
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Azure SQL Database Configuration
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=your-admin-username
AZURE_SQL_PASSWORD=your-admin-password

# Azure Blob Storage Configuration
AZURE_STORAGE_ACCOUNT=yourstorageaccount
AZURE_STORAGE_KEY=your-storage-access-key
AZURE_STORAGE_CONTAINER=family-album-media
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Testing (Optional)

The application includes Playwright tests for automated testing:

```bash
# Run all tests
npm test

# Run tests with browser visible
npm run test:headed

# Run tests in debug mode
npm run test:debug
```

Tests use **dev mode** to bypass authentication. See [tests/README.md](tests/README.md) for more details.

## Deployment to Azure

### Option 1: Azure Static Web Apps (Recommended)

Azure Static Web Apps provides free hosting for small applications with automatic CI/CD.

1. Push your code to GitHub
2. Create an Azure Static Web App linked to your repository
3. Add environment variables in Azure Portal:
   - Go to your Static Web App > Configuration
   - Add all environment variables from `.env.local`
4. Azure will automatically build and deploy on every push

### Option 2: Azure App Service

For more control and scaling options:

1. Create an Azure App Service (Linux, Node.js 18+)
2. Configure deployment from GitHub or Azure DevOps
3. Add environment variables in App Service Configuration
4. Deploy using:

```bash
npm run build
```

## Cost Optimization Tips

This application is designed to be cost-effective for small family use:

1. **Azure SQL Serverless**: 
   - Automatically pauses when not in use
   - Estimated cost: $5-15/month with minimal usage
   - Set auto-pause delay to 1 hour

2. **Azure Blob Storage**:
   - Standard LRS tier
   - Estimated cost: $0.50-2/month for 10GB of photos
   - Use lifecycle policies to archive old photos to Cool tier

3. **Azure Static Web Apps**:
   - Free tier available (100GB bandwidth/month)
   - Perfect for small family applications

4. **Total Estimated Cost**: $5-20/month for a family of 10-20 users

## Database Schema

The application uses four main tables:

- **NameEvent**: Stores people (neType='N') and events (neType='E')
- **Pictures**: Stores metadata for all photos and videos
- **NamePhoto**: Many-to-many relationship between people/events and media
- **UnindexedFiles**: Staging area for newly uploaded files

See `database/schema.sql` for complete schema definition.

## API Endpoints

### People Management
- `GET /api/people` - Get all people or search by name
- `GET /api/people/[id]` - Get specific person
- `POST /api/people` - Create new person
- `PUT /api/people/[id]` - Update person
- `DELETE /api/people/[id]` - Delete person

### Event Management
- `GET /api/events` - Get all events or search by name
- `GET /api/events/[id]` - Get specific event
- `POST /api/events` - Create new event
- `PUT /api/events/[id]` - Update event
- `DELETE /api/events/[id]` - Delete event

### Media Management
- `GET /api/media` - Get media items with filtering
- `GET /api/media/[filename]` - Get specific media item with details
- `PUT /api/media/[filename]` - Update media metadata
- `DELETE /api/media/[filename]` - Delete media item

## Future Enhancements

The following features are planned for future releases:

- [ ] Upload interface for new photos/videos
- [ ] Batch tagging and editing
- [ ] Facial recognition for automatic tagging
- [ ] Advanced search with date ranges
- [ ] Export and sharing capabilities
- [ ] Mobile-responsive improvements
- [ ] Backup and restore functionality
- [ ] Event file export

## Security Considerations

1. **Database**: Use Azure SQL firewall rules to restrict access
2. **Storage**: Use SAS tokens for temporary access to blob storage
3. **Authentication**: Consider adding Azure AD B2C for user authentication
4. **Environment Variables**: Never commit `.env.local` to version control
5. **HTTPS**: Always use HTTPS in production (automatic with Azure)

## Troubleshooting

### Database Connection Issues
- Verify firewall rules allow your IP
- Check connection string format
- Ensure database is not paused (serverless tier)

### Storage Upload Failures
- Verify storage account access key
- Check container exists and has proper permissions
- Ensure blob names don't contain invalid characters

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Check Node.js version (18+ required)
- Clear `.next` folder and rebuild

## Support

For issues and questions:
1. Check the `REQUIREMENTS_DOCUMENT.md` for detailed specifications
2. Review database queries in `database/queries.sql`
3. Check Azure Portal for service health and logs

## License

This is a private family application. All rights reserved.

## Version History

- **v1.0.0** (October 2025) - Initial release with core functionality
  - People and event management
  - Photo/video browsing and filtering
  - Metadata management
  - Azure SQL and Blob Storage integration
