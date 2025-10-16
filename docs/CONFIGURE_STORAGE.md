# Configure Azure Storage for Photo Upload

You're getting the error because Azure Storage credentials are not configured. Here's how to set them up:

## Option 1: Use Existing Azure Resources (Recommended if you have them)

If you already have Azure Storage and SQL Database set up:

1. **Open** `api/local.settings.json`

2. **Replace the placeholder values** with your actual Azure credentials:
   - `AZURE_STORAGE_ACCOUNT` - Your storage account name
   - `AZURE_STORAGE_KEY` - Your storage account access key
   - `AZURE_STORAGE_CONTAINER` - Container name (default: `family-album-media`)
   - `AZURE_SQL_SERVER` - Your SQL server address
   - `AZURE_SQL_DATABASE` - Your database name
   - `AZURE_SQL_USER` - Your SQL username
   - `AZURE_SQL_PASSWORD` - Your SQL password

3. **Restart the API** (Ctrl+C in the terminal, then `npm start` again)

4. **Run the upload script again**

### Where to Find Azure Storage Credentials:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your **Storage Account**
3. Go to **Security + networking** → **Access keys**
4. Copy:
   - **Storage account name** (from the top)
   - **Key** (key1 or key2)

### Where to Find Azure SQL Database Credentials:

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your **SQL Database**
3. Go to **Overview** to find:
   - Server name (e.g., `yourserver.database.windows.net`)
   - Database name
4. You'll need the admin username and password you created when setting up the database

---

## Option 2: Use Local Storage (For Testing Only)

If you want to test locally without Azure, we can use **Azurite** (Azure Storage Emulator):

### Install Azurite:
```powershell
npm install -g azurite
```

### Start Azurite:
```powershell
azurite --silent --location c:\azurite --debug c:\azurite\debug.log
```

### Update `api/local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "AZURE_STORAGE_ACCOUNT": "devstoreaccount1",
    "AZURE_STORAGE_KEY": "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==",
    "AZURE_STORAGE_CONTAINER": "family-album-media"
  }
}
```

**Note:** Local storage won't work with SQL Database - you'll still need Azure SQL Database or use SQLite for local development.

---

## Option 3: Create New Azure Resources

If you don't have Azure resources yet, run the deployment script:

```powershell
.\scripts\deploy.ps1
```

This will:
1. Create a resource group
2. Set up Azure Storage
3. Set up Azure SQL Database
4. Create a Static Web App
5. Generate a `deployment-info-*.txt` file with all credentials

After deployment, the script will tell you the credentials to use.

---

## Current Status

⚠️ **The API is running but can't upload files because:**
- Azure Storage credentials are missing or invalid
- The storage account name in `local.settings.json` needs to be updated

## Next Steps

1. Choose an option above
2. Configure the credentials
3. Restart the API
4. Run the upload script again: `.\scripts\upload-albums.ps1`
