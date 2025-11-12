# Azure Setup Guide for Family Album

This guide walks you through setting up all Azure resources needed for the Family Album application.

## Step 1: Create Resource Group

1. Log in to [Azure Portal](https://portal.azure.com)
2. Click "Resource groups" > "Create"
3. Fill in:
   - **Subscription**: Your Azure subscription
   - **Resource group name**: `family-album-rg`
   - **Region**: Choose closest to you (e.g., `East US`, `West Europe`)
4. Click "Review + Create" > "Create"

## Step 2: Create Azure SQL Database (Basic Tier)

### Create Server and Database

1. In Azure Portal, search for "SQL databases"
2. Click "Create"
3. **Basics tab**:
   - **Resource group**: Select `family-album-rg`
   - **Database name**: `FamilyAlbum`
   - **Server**: Click "Create new"
     - **Server name**: `family-album-sql-server` (or your preferred unique name)
     - **Location**: Same as resource group
     - **Authentication method**: SQL authentication
     - **Server admin login**: Choose a username (e.g., `familyadmin`)
     - **Password**: Create a strong password (save this!)
   - Click "OK"

4. **Compute + storage**:
   - Click "Configure database"
   - **Service tier**: Select "Basic"
   - **Data max size**: 2 GB (sufficient for metadata)
   - Click "Apply"

5. **Networking tab**:
   - **Connectivity method**: Public endpoint
   - **Firewall rules**:
     - ☑ Add current client IP address
     - ☑ Allow Azure services and resources to access this server

6. Click "Review + Create" > "Create"

### Configure Firewall (if needed)

1. After creation, go to your SQL Server
2. Select "Networking" under Security
3. Add your home/office IP address if not already added
4. Click "Save"

### Initialize Database Schema

1. Download and install [Azure Data Studio](https://docs.microsoft.com/en-us/sql/azure-data-studio/download-azure-data-studio)
2. Connect to your database:
   - **Connection type**: Microsoft SQL Server
   - **Server**: `family-album-sql-server.database.windows.net`
   - **Authentication type**: SQL Login
   - **User name**: Your admin username
   - **Password**: Your admin password
   - **Database**: FamilyAlbum
3. Open the file `database/schema.sql`
4. Execute the script (F5 or click "Run")
5. Verify tables are created:
   ```sql
   SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
   ```

## Step 3: Create Azure Storage Account

### Create Storage Account

1. In Azure Portal, search for "Storage accounts"
2. Click "Create"
3. **Basics tab**:
   - **Resource group**: `family-album-rg`
   - **Storage account name**: `familyalbumstore` (must be globally unique, lowercase, no spaces)
   - **Region**: Same as resource group
   - **Performance**: Standard
   - **Redundancy**: LRS (Locally-redundant storage)

4. **Advanced tab**:
   - **Security**: Keep defaults
   - **Blob storage**: Hot access tier

5. Click "Review + Create" > "Create"

### Create Blob Container

1. After creation, go to your storage account
2. Select "Containers" under Data storage
3. Click "+ Container"
4. **Name**: `family-album-media`
5. **Public access level**: Private (default)
6. Click "Create"

### Get Access Keys

1. In your storage account, select "Access keys" under Security + networking
2. Click "Show keys"
3. Copy **Key1**:
   - **Storage account name**: (e.g., `familyalbumstore`)
   - **Key**: Copy the entire key string
4. Save these securely - you'll need them for environment variables

## Step 4: Configure Environment Variables

Create a `.env.local` file in your project root:

```env
# Azure SQL Database
AZURE_SQL_SERVER=family-album-sql-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=familyadmin
AZURE_SQL_PASSWORD=YourStrongPasswordHere

# Azure Blob Storage
AZURE_STORAGE_ACCOUNT=familyalbumstore
AZURE_STORAGE_KEY=YourStorageKeyHere==
AZURE_STORAGE_CONTAINER=family-album-media
```

## Step 5: Test Connection Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run development server:
   ```bash
   npm run dev
   ```

3. Open http://localhost:3000
4. Check browser console for any connection errors

## Step 6: Deploy to Azure Static Web Apps

### Create Static Web App

1. In Azure Portal, search for "Static Web Apps"
2. Click "Create"
3. **Basics tab**:
   - **Resource group**: `family-album-rg`
   - **Name**: `family-album-app`
   - **Plan type**: Free
   - **Region**: Choose closest to you
   - **Deployment source**: GitHub
   - Click "Sign in with GitHub"
   - Authorize Azure to access your GitHub
   - **Organization**: Your GitHub username/org
   - **Repository**: `FamilyAlbumTest`
   - **Branch**: `main`

4. **Build Details**:
   - **Build Presets**: Next.js
   - **App location**: `/`
   - **Api location**: (leave empty)
   - **Output location**: `.next`

5. Click "Review + Create" > "Create"

### Configure Environment Variables in Azure

1. After deployment, go to your Static Web App
2. Select "Configuration" under Settings
3. Click "Add" to add each environment variable:
   - Name: `AZURE_SQL_SERVER`, Value: `family-album-sql-server.database.windows.net`
   - Name: `AZURE_SQL_DATABASE`, Value: `FamilyAlbum`
   - Name: `AZURE_SQL_USER`, Value: Your admin username
   - Name: `AZURE_SQL_PASSWORD`, Value: Your admin password
   - Name: `AZURE_STORAGE_ACCOUNT`, Value: `familyalbumstore`
   - Name: `AZURE_STORAGE_KEY`, Value: Your storage key
   - Name: `AZURE_STORAGE_CONTAINER`, Value: `family-album-media`
4. Click "Save"

### Verify Deployment

1. Wait for GitHub Actions workflow to complete
2. Go to "Overview" in your Static Web App
3. Click the URL to open your deployed app
4. Test basic functionality

## Cost Estimation

Based on minimal usage (10-20 users, 5GB photos, 100 page views/month):

| Service | Configuration | Estimated Monthly Cost |
|---------|--------------|----------------------|
| Azure SQL Database | Basic tier, always-on, 2GB | ~$5 |
| Azure Blob Storage | Standard LRS, 5GB hot tier | $0.50-1 |
| Azure Static Web Apps | Free tier, <100GB bandwidth | $0 |
| **Total** | | **$5.50-6** |

### Cost Saving Tips

1. **SQL Database**:
   - Basic tier provides predictable costs (~$5/month)
   - No cold start delays (always-on)
   - 2GB storage is sufficient for metadata
   - Upgrade to Standard tier if you need more storage or performance

2. **Blob Storage**:
   - Use lifecycle management to move old photos to Cool tier after 90 days
   - Compress images before upload
   - Delete unused thumbnails

3. **Static Web Apps**:
   - Stay within free tier (100GB bandwidth/month)
   - Use CDN caching

4. **Monitoring**:
   - Set up cost alerts in Azure Portal
   - Review Azure Cost Management regularly

## Troubleshooting

### Can't connect to SQL Database
- Check firewall rules include your IP
- Verify credentials are correct
- Ensure database is not paused (may take 1-2 minutes to wake up)

### Storage upload fails
- Verify storage account key is correct
- Check container exists and name matches
- Ensure SAS token hasn't expired (if using)

### Deployment fails
- Check GitHub Actions logs for errors
- Verify all environment variables are set
- Ensure Next.js build completes locally first

### High costs
- Check SQL database isn't staying active (should auto-pause)
- Review storage tier (Hot vs Cool)
- Monitor bandwidth usage in Static Web Apps

## Security Checklist

- [ ] SQL Server firewall configured (not open to all IPs)
- [ ] Storage account keys kept secure (not in source control)
- [ ] Environment variables set in Azure (not hardcoded)
- [ ] HTTPS enabled (automatic with Azure)
- [ ] Consider adding Azure AD authentication
- [ ] Regular backups configured for SQL Database
- [ ] Monitor Azure Security Center recommendations

## Next Steps

1. Add sample people and events to test
2. Upload test photos
3. Configure backup strategy
4. Set up monitoring and alerts
5. Consider adding authentication (Azure AD B2C)
6. Plan data migration from existing system

## Support Resources

- [Azure SQL Database Pricing](https://azure.microsoft.com/pricing/details/azure-sql-database/single/)
- [Azure Blob Storage Pricing](https://azure.microsoft.com/en-us/pricing/details/storage/blobs/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Next.js on Azure](https://docs.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs)
