# Setup Checklist for Family Album Web App

Complete these steps to get your Family Album application running.

## Prerequisites Installation

### 1. Install Node.js
- [ ] Download Node.js 18+ from https://nodejs.org/
- [ ] Choose "LTS" (Long Term Support) version
- [ ] Run installer with default options
- [ ] Verify installation:
  ```powershell
  node --version
  npm --version
  ```

### 2. Install Git (if not already installed)
- [ ] Download from https://git-scm.com/
- [ ] Run installer with default options
- [ ] Verify: `git --version`

### 3. Install Azure Data Studio
- [ ] Download from https://docs.microsoft.com/sql/azure-data-studio/download
- [ ] Used for managing Azure SQL Database

## Azure Resources Setup

### 1. Create Azure Account
- [ ] Sign up at https://azure.microsoft.com/free/
- [ ] Provides $200 credit for first 30 days
- [ ] Credit card required (but won't be charged without approval)

### 2. Create Resource Group
- [ ] Log in to Azure Portal
- [ ] Create resource group: `family-album-rg`
- [ ] Choose region closest to you

### 3. Create Azure SQL Database
- [ ] Create new SQL Server and Database
- [ ] Configuration:
  - Database name: `FamilyAlbum`
  - Compute: Serverless (0.5-2 vCores)
  - Max data size: 5-10 GB
  - Auto-pause: 60 minutes
- [ ] Note server name: `__________.database.windows.net`
- [ ] Note admin username: `__________`
- [ ] Note admin password: `__________`
- [ ] Configure firewall: Add your client IP

### 4. Initialize Database
- [ ] Open Azure Data Studio
- [ ] Connect to your Azure SQL Database
- [ ] Open `database/schema.sql`
- [ ] Execute script (F5)
- [ ] Verify tables created

### 5. Create Azure Storage Account
- [ ] Create storage account
- [ ] Name: `familyalbumstore` (must be globally unique)
- [ ] Performance: Standard
- [ ] Replication: LRS
- [ ] Create container: `family-album-media`
- [ ] Note account name: `__________`
- [ ] Copy access key from Azure Portal
- [ ] Note access key: `__________`

## Local Development Setup

### 1. Install Project Dependencies
```powershell
cd c:\Users\mikmort\Documents\Code\FamilyAlbumTest
npm install
```
- [ ] Wait for installation to complete
- [ ] Check for any error messages

### 2. Configure Environment Variables
- [ ] Copy `.env.local.example` to `.env.local`
- [ ] Edit `.env.local` with your values:

```env
AZURE_SQL_SERVER=your-server.database.windows.net
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=your-admin-username
AZURE_SQL_PASSWORD=your-strong-password

AZURE_STORAGE_ACCOUNT=familyalbumstore
AZURE_STORAGE_KEY=your-access-key-here
AZURE_STORAGE_CONTAINER=family-album-media
```

### 3. Test Local Development Server
```powershell
npm run dev
```
- [ ] Server starts without errors
- [ ] Open http://localhost:3000
- [ ] Application loads successfully

### 4. Add Test Data
Using Azure Data Studio:

```sql
-- Add test people
INSERT INTO NameEvent (neName, neRelation, neType) VALUES
('John Doe', 'Father', 'N'),
('Jane Doe', 'Mother', 'N'),
('Tommy Doe', 'Son', 'N');

-- Add test event
INSERT INTO NameEvent (neName, neRelation, neType) VALUES
('Christmas 2024', 'Holiday celebration', 'E');
```
- [ ] Test data inserted successfully
- [ ] Refresh app and verify people appear in selector

## Deployment to Azure

### 1. Create GitHub Repository
- [ ] Create new repo on GitHub: `FamilyAlbumTest`
- [ ] Push local code to GitHub:
  ```powershell
  git init
  git add .
  git commit -m "Initial commit"
  git remote add origin https://github.com/yourusername/FamilyAlbumTest.git
  git branch -M main
  git push -u origin main
  ```

### 2. Create Azure Static Web App
- [ ] In Azure Portal, create Static Web App
- [ ] Name: `family-album-app`
- [ ] Plan: Free
- [ ] Connect to GitHub repository
- [ ] Build preset: Next.js
- [ ] App location: `/`
- [ ] Output location: `.next`

### 3. Configure Environment Variables in Azure
- [ ] Go to Static Web App > Configuration
- [ ] Add all environment variables from `.env.local`
- [ ] Save configuration

### 4. Wait for Deployment
- [ ] Check GitHub Actions tab for deployment status
- [ ] Wait for build to complete (5-10 minutes)
- [ ] Visit your app URL (shown in Azure Portal)

## Verification Checklist

### Local Testing
- [ ] App loads at http://localhost:3000
- [ ] People selector shows test people
- [ ] No console errors in browser
- [ ] Can navigate between screens
- [ ] Database connection works

### Azure Testing
- [ ] Deployed app loads from Azure URL
- [ ] Same functionality as local
- [ ] Environment variables working
- [ ] Database accessible from Azure
- [ ] Storage accessible from Azure

## Optional: Data Migration

If migrating from existing SQLite database:

### 1. Export SQLite Data
- [ ] Use SQLite Browser or command line
- [ ] Export tables to CSV files
- [ ] Save thumbnails as separate files

### 2. Upload Media Files
- [ ] Use Azure Storage Explorer
- [ ] Upload all photos to `family-album-media/media/`
- [ ] Upload all thumbnails to `family-album-media/thumbnails/`

### 3. Import Data to Azure SQL
- [ ] Follow steps in `database/migration.sql`
- [ ] Use BULK INSERT or bcp utility
- [ ] Verify counts match original database

### 4. Update URLs
- [ ] Run SQL script to update blob URLs
- [ ] Test random photos load correctly

## Cost Monitoring Setup

### 1. Set Up Budget Alerts
- [ ] Go to Azure Portal > Cost Management
- [ ] Create budget: $20/month
- [ ] Set alerts at 50%, 75%, 90%

### 2. Review Resource Configuration
- [ ] SQL Database: Serverless with auto-pause ✓
- [ ] Storage: Standard LRS ✓
- [ ] Static Web App: Free tier ✓

### 3. Regular Checks
- [ ] Check costs weekly first month
- [ ] Adjust SQL auto-pause if needed
- [ ] Monitor bandwidth usage

## Troubleshooting

### Cannot connect to database
1. Check firewall rules in Azure Portal
2. Verify credentials in `.env.local`
3. Wait 1-2 minutes if database was paused
4. Test connection in Azure Data Studio

### Upload fails
1. Check storage account key
2. Verify container exists
3. Check file size limits
4. Review error logs in browser console

### Build fails on Azure
1. Check GitHub Actions logs
2. Verify environment variables set in Azure
3. Test build locally first: `npm run build`
4. Check Node.js version compatibility

### High costs
1. Verify SQL auto-pause is working
2. Check for unused resources
3. Review bandwidth usage
4. Consider storage tier optimization

## Success Criteria

✅ You're ready to use the app when:
- [ ] Application loads without errors (local and Azure)
- [ ] Can browse photos by people/events
- [ ] Can view photo details and metadata
- [ ] Can edit descriptions and dates
- [ ] Database operations work correctly
- [ ] Costs are within expected range ($5-20/month)

## Next Features to Build

After basic setup is working:
1. File upload interface
2. Process new files screen
3. Full management screens (people/events)
4. Batch operations
5. Backup/restore functionality

## Support Resources

- **Azure Documentation**: https://docs.microsoft.com/azure/
- **Next.js Documentation**: https://nextjs.org/docs
- **Project Documentation**: See README.md, AZURE_SETUP.md
- **GitHub Issues**: Create issues for bugs/features

## Notes

- Keep your `.env.local` file secure - never commit to Git
- Save all Azure credentials in a secure location
- Original SQLite database is a backup - keep it safe
- Test thoroughly before inviting family to use
- Set expectations: Some features still in development

---

**Estimated Setup Time**: 2-3 hours for first-time Azure users
**Estimated Cost**: $5-20/month for typical family usage
**Technical Level**: Intermediate (following guides carefully)

Good luck with your Family Album application! 🎉📸
