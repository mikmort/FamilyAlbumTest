# Deploy Family Album Infrastructure with Bicep

This directory contains Infrastructure as Code (IaC) using Azure Bicep templates to automate the deployment of all Azure resources.

## Architecture Overview

- **Azure SQL Database (Basic)**: Always-on, 2GB
- **Azure Blob Storage**: Standard LRS, Hot tier, 40GB+ capacity
- **Azure Static Web App**: Free tier with MSA authentication
- **Region**: East US (optimized for your location)
- **Users**: Optimized for ~20 users

## Prerequisites

1. **Azure CLI** - Install from https://docs.microsoft.com/cli/azure/install-azure-cli
   ```powershell
   winget install Microsoft.AzureCLI
   ```

2. **Bicep CLI** - Automatically installed with Azure CLI 2.20.0+
   ```powershell
   az bicep version
   ```

3. **Azure Subscription** - Active subscription with Owner or Contributor role

4. **PowerShell 7+** - Recommended for Windows

## Quick Start

### 1. Login to Azure

```powershell
az login
az account show
az account set --subscription "Your-Subscription-Name-Or-Id"
```

### 2. Set Variables

```powershell
$sqlAdminUsername = "familyadmin"
$sqlAdminPassword = "YourStrongPassword123!" # Change this!
$environment = "prod"
$location = "eastus"
```

### 3. Deploy Infrastructure

```powershell
# Deploy everything with one command
az deployment sub create `
  --name "familyalbum-deployment-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --location $location `
  --template-file infrastructure/main.bicep `
  --parameters environment=$environment `
               location=$location `
               sqlAdminUsername=$sqlAdminUsername `
               sqlAdminPassword=$sqlAdminPassword
```

### 4. Get Deployment Outputs

```powershell
# Get all outputs
$deployment = az deployment sub show `
  --name "familyalbum-deployment-latest" `
  --query properties.outputs `
  --output json | ConvertFrom-Json

# Display connection information
Write-Host "SQL Server: $($deployment.sqlServerFqdn.value)"
Write-Host "SQL Database: $($deployment.sqlDatabaseName.value)"
Write-Host "Storage Account: $($deployment.storageAccountName.value)"
Write-Host "Web App URL: $($deployment.staticWebAppUrl.value)"
```

## Detailed Deployment Steps

### Step 1: Validate Templates

Before deploying, validate the Bicep templates:

```powershell
# Validate main template
az deployment sub validate `
  --location eastus `
  --template-file infrastructure/main.bicep `
  --parameters environment=prod `
               location=eastus `
               sqlAdminUsername=familyadmin `
               sqlAdminPassword="YourPassword123!"
```

### Step 2: What-If Analysis

Preview what will be created:

```powershell
az deployment sub what-if `
  --location eastus `
  --template-file infrastructure/main.bicep `
  --parameters environment=prod `
               location=eastus `
               sqlAdminUsername=familyadmin `
               sqlAdminPassword="YourPassword123!"
```

### Step 3: Deploy

Deploy all resources:

```powershell
$deploymentName = "familyalbum-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

az deployment sub create `
  --name $deploymentName `
  --location eastus `
  --template-file infrastructure/main.bicep `
  --parameters environment=prod `
               location=eastus `
               sqlAdminUsername=familyadmin `
               sqlAdminPassword="YourPassword123!"
```

### Step 4: Initialize Database

After infrastructure is deployed, initialize the database schema:

```powershell
# Get SQL connection info
$sqlServer = az deployment sub show --name $deploymentName --query 'properties.outputs.sqlServerFqdn.value' -o tsv
$sqlDatabase = az deployment sub show --name $deploymentName --query 'properties.outputs.sqlDatabaseName.value' -o tsv

# Run schema script using Azure CLI
az sql db show-connection-string `
  --server $sqlServer `
  --name $sqlDatabase `
  --client sqlcmd

# Or use Azure Data Studio to connect and run database/schema.sql
```

### Step 5: Configure Static Web App

```powershell
# Get Static Web App name and resource group
$staticWebAppName = az deployment sub show --name $deploymentName --query 'properties.outputs.staticWebAppName.value' -o tsv
$resourceGroup = az deployment sub show --name $deploymentName --query 'properties.outputs.resourceGroupName.value' -o tsv

# Get deployment token for GitHub Actions
$deploymentToken = az staticwebapp secrets list `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --query properties.apiKey -o tsv

Write-Host "Add this to GitHub Secrets as AZURE_STATIC_WEB_APPS_API_TOKEN:"
Write-Host $deploymentToken
```

### Step 6: Configure Environment Variables

Get the storage account key and configure environment variables:

```powershell
$storageAccountName = az deployment sub show --name $deploymentName --query 'properties.outputs.storageAccountName.value' -o tsv
$storageAccountKey = az storage account keys list `
  --account-name $storageAccountName `
  --resource-group $resourceGroup `
  --query '[0].value' -o tsv

# Configure Static Web App environment variables
az staticwebapp appsettings set `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --setting-names `
    AZURE_SQL_SERVER=$sqlServer `
    AZURE_SQL_DATABASE=$sqlDatabase `
    AZURE_SQL_USER=$sqlAdminUsername `
    AZURE_SQL_PASSWORD=$sqlAdminPassword `
    AZURE_STORAGE_ACCOUNT=$storageAccountName `
    AZURE_STORAGE_KEY=$storageAccountKey `
    AZURE_STORAGE_CONTAINER=family-album-media
```

## MSA Authentication Setup

To enable Microsoft Account (MSA) authentication for editing:

### 1. Register Azure AD Application

```powershell
# Create app registration
$appName = "FamilyAlbum-Auth"
$app = az ad app create `
  --display-name $appName `
  --sign-in-audience AzureADandPersonalMicrosoftAccount `
  --query appId -o tsv

Write-Host "App ID (Client ID): $app"

# Create client secret
$secret = az ad app credential reset `
  --id $app `
  --query password -o tsv

Write-Host "Client Secret: $secret"
Write-Host "Save this secret securely - it won't be shown again!"
```

### 2. Configure Redirect URIs

```powershell
$webAppUrl = az deployment sub show --name $deploymentName --query 'properties.outputs.staticWebAppUrl.value' -o tsv

az ad app update `
  --id $app `
  --web-redirect-uris "$webAppUrl/.auth/login/aad/callback"
```

### 3. Update Static Web App

```powershell
# Add AAD Client ID and Secret to Static Web App
az staticwebapp appsettings set `
  --name $staticWebAppName `
  --resource-group $resourceGroup `
  --setting-names `
    AAD_CLIENT_ID=$app `
    AAD_CLIENT_SECRET=$secret
```

### 4. Configure Route Authorization

Create `staticwebapp.config.json` in your project root:

```json
{
  "routes": [
    {
      "route": "/api/*",
      "methods": ["POST", "PUT", "DELETE"],
      "allowedRoles": ["authenticated"]
    },
    {
      "route": "/*",
      "methods": ["GET"],
      "allowedRoles": ["anonymous", "authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "redirect": "/.auth/login/aad",
      "statusCode": 302
    }
  }
}
```

## Cost Optimization

The Bicep templates include several cost optimizations:

1. **SQL Database Basic Tier**
   - Always-on (no cold start delays)
   - Predictable fixed cost
   - Estimated: ~$5/month

2. **Blob Storage Lifecycle**
   - Moves files to Cool tier after 90 days
   - Archives after 365 days
   - Estimated: $1-3/month for 40GB

3. **Static Web App Free Tier**
   - 100GB bandwidth/month (sufficient for 20 users)
   - $0/month

**Total Estimated Cost: $6-8/month**

## Monitoring and Alerts

Set up cost alerts:

```powershell
# Create budget alert
az consumption budget create `
  --budget-name "FamilyAlbum-Monthly-Budget" `
  --amount 25 `
  --time-grain Monthly `
  --time-period start-date="$(Get-Date -Format 'yyyy-MM-01')" `
  --category Cost `
  --notifications actual@90 `
  --contact-emails your-email@example.com
```

## Update and Redeploy

To update infrastructure:

```powershell
# Make changes to Bicep files, then redeploy
az deployment sub create `
  --name "familyalbum-update-$(Get-Date -Format 'yyyyMMdd-HHmmss')" `
  --location eastus `
  --template-file infrastructure/main.bicep `
  --parameters environment=prod
```

Bicep is **idempotent** - it only creates/updates resources that changed.

## Cleanup

To delete all resources:

```powershell
$resourceGroup = az deployment sub show --name $deploymentName --query 'properties.outputs.resourceGroupName.value' -o tsv

# Delete resource group (deletes everything)
az group delete --name $resourceGroup --yes --no-wait
```

## Troubleshooting

### Deployment Fails

```powershell
# Get deployment error details
az deployment sub show `
  --name $deploymentName `
  --query properties.error
```

### SQL Connection Issues

```powershell
# Check firewall rules
az sql server firewall-rule list `
  --server $sqlServer `
  --resource-group $resourceGroup

# Add your current IP
$myIp = (Invoke-WebRequest -Uri "https://api.ipify.org").Content
az sql server firewall-rule create `
  --server $sqlServer `
  --resource-group $resourceGroup `
  --name "MyCurrentIP" `
  --start-ip-address $myIp `
  --end-ip-address $myIp
```

### Storage Access Issues

```powershell
# Verify storage account exists
az storage account show `
  --name $storageAccountName `
  --resource-group $resourceGroup

# Test connection
az storage container list `
  --account-name $storageAccountName `
  --account-key $storageAccountKey
```

## Next Steps

After infrastructure is deployed:

1. ✅ Initialize database schema (`database/schema.sql`)
2. ✅ Configure GitHub repository secrets
3. ✅ Set up MSA authentication
4. ✅ Create `.env.local` for local development
5. ✅ Test application locally
6. ✅ Push to GitHub to trigger deployment
7. ✅ Migrate existing data
8. ✅ Set up monitoring and alerts

## Reference

- [Azure Bicep Documentation](https://docs.microsoft.com/azure/azure-resource-manager/bicep/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [Static Web Apps CLI](https://docs.microsoft.com/azure/static-web-apps/static-web-apps-cli-overview)
