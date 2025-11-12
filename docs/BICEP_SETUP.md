# Infrastructure as Code with Azure Bicep - Setup Complete! 🎉

I've created a complete Infrastructure as Code solution using Azure Bicep, optimized for your requirements!

## What's Been Created

### 📦 Bicep Templates

1. **main.bicep** - Main orchestration template
2. **modules/infrastructure.bicep** - SQL Database + Blob Storage
3. **modules/staticwebapp.bicep** - Web hosting with MSA auth
4. **deploy.ps1** - Automated deployment script
5. **staticwebapp.config.json** - Route-based authorization

### 🎯 Optimizations for Your Requirements

✅ **East US Region** - All resources in East US  
✅ **40GB Storage** - Blob storage with lifecycle management  
✅ **20 Users** - SQL scaled for concurrent access  
✅ **MSA Authentication** - View anonymously, edit with Microsoft Account  
✅ **Cost-Effective** - $12-24/month estimated  

## Quick Start

### 1. Install Azure CLI

```powershell
winget install Microsoft.AzureCLI
```

### 2. Run Deployment Script

```powershell
cd c:\Users\mikmort\Documents\Code\FamilyAlbumTest
.\infrastructure\deploy.ps1
```

The script will:
- ✅ Log you into Azure
- ✅ Validate templates
- ✅ Show what-if preview
- ✅ Deploy all resources (5-10 minutes)
- ✅ Create .env.local file
- ✅ Save deployment info
- ✅ Provide GitHub secret for deployment

### 3. Initialize Database

1. Install Azure Data Studio
2. Connect to SQL server (details from deployment)
3. Run `database/schema.sql`

### 4. Configure GitHub

Add secret: `AZURE_STATIC_WEB_APPS_API_TOKEN` (value from deployment)

## What Gets Deployed

- **Resource Group**: `familyalbum-prod-rg`
- **SQL Server**: Basic tier (always-on, 2GB)
- **SQL Database**: 2GB, auto-backup
- **Storage Account**: 40GB+, lifecycle management
- **Static Web App**: Free tier with MSA auth

## Authentication Setup

**Viewing (No Auth Required):**
- Browse photos
- View details
- Search

**Editing (MSA Required):**
- Add/edit people & events
- Upload photos
- Edit metadata

## Cost Breakdown

| Service | Monthly Cost |
|---------|--------------|
| SQL Database (Basic) | ~$5 |
| Blob Storage (40GB) | $2-4 |
| Static Web App | $0 |
| **Total** | **$7-9** |

## Ready to Deploy?

```powershell
.\infrastructure\deploy.ps1
```

See `infrastructure/README.md` for detailed documentation!
