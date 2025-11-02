# Family Album - Quick Start Guide

## For Family Members (Non-Technical)

### Accessing the Application

1. Open your web browser (Chrome, Firefox, Safari, or Edge)
2. Go to: `https://your-app-name.azurestaticapps.net` (URL will be provided by admin)
3. Bookmark this page for easy access

### Browsing Photos

1. On the start screen, select people you want to see photos of:
   - Check the boxes next to their names (up to 5 people)
   - Or select an event from the dropdown menu
   - Or check "Show photos with no people tagged"

2. Choose sort order:
   - "Newest to Oldest" - See recent photos first
   - "Oldest to Newest" - See old photos first

3. Click "Continue to Gallery"

4. Click any photo to see it full-size with all details

### Viewing Photo Details

When you click a photo, you'll see:
- The full-size photo or video
- Who's in the photo
- What event it's from
- When it was taken
- Description

### Tips

- You can select multiple people to see all photos with ANY of them
- Check "Show only photos with ALL selected people" to be more specific
- Photos organized by month and year
- Videos show a "VIDEO" indicator in the corner

## For Administrators

### First-Time Setup

1. Follow instructions in `AZURE_SETUP.md` to:
   - Create Azure resources
   - Set up database
   - Configure storage
   - Deploy application

2. Add initial people and events:
   - Click "Manage People" to add family members
   - Click "Manage Events" to create events
   - Include relationships (e.g., "Father", "Cousin", "Uncle")

3. Upload photos:
   - Photos should be placed in Azure Blob Storage
   - Database entries created via API
   - Thumbnails generated automatically

### Regular Maintenance

- **Weekly**: Check that database auto-pauses (saves money)
- **Monthly**: Review Azure costs in portal
- **Quarterly**: Back up database
- **As needed**: Add new people/events, tag photos

### Cost Monitoring

- Set up Azure Cost Alerts for $10, $20, $30
- Check actual costs in Azure Portal > Cost Management
- Expected: $5-20/month for family of 10-20 users

### Troubleshooting

**App won't load:**
- Check Azure Portal - is SQL database paused? (Takes 1-2 min to wake up)
- Check if Static Web App is running

**Photos not displaying:**
- Verify Azure Blob Storage is accessible
- Check thumbnail URLs in database

**High costs:**
- Ensure SQL Database auto-pause is enabled
- Check bandwidth usage
- Consider moving old photos to Cool storage tier

### Support

For technical issues:
1. Check `README.md` for detailed documentation
2. Review `AZURE_SETUP.md` for setup help
3. Check Azure Portal for service status
4. Review GitHub Actions for deployment issues

### Backup Strategy

**Automated** (coming soon):
- Daily database backups to Azure Blob Storage
- 30-day retention

**Manual**:
- Export database using Azure Data Studio
- Download blob storage snapshots
- Keep local copies of original photos

### Adding New Features

The application is built with Next.js and can be extended:
- Edit React components in `components/` folder
- Add API routes in `app/api/` folder
- Modify database schema in `database/schema.sql`
- Push changes to GitHub (auto-deploys)

### Security Notes

- All data is private (not publicly accessible)
- Consider adding authentication for additional security
- Keep environment variables secure
- Don't share database credentials
- Use HTTPS only (automatic with Azure)

## Common Tasks

### Add a New Person

1. Click "Manage People"
2. Click "Add New Person"
3. Enter name and relationship
4. Click "Save"

### Add a New Event

1. Click "Manage Events"
2. Click "Add New Event"
3. Enter event name and details
4. Click "Save"

### Tag People in Photos

1. Browse to the photo
2. Click to open detail view
3. Click "Edit"
4. Select people from dropdown
5. Click "Save"

### Update Photo Information

1. Open photo detail view
2. Click "Edit"
3. Update description, date, or people
4. Click "Save"

## Emergency Contacts

**Application Admin**: [Your Name]
- Email: [your.email@example.com]
- Phone: [Your Phone]

**Azure Subscription Owner**: [Name]
- Email: [owner.email@example.com]

## Version Information

- Application Version: 1.0.0
- Last Updated: October 2025
- Built with: Next.js 14, Azure SQL, Azure Blob Storage
