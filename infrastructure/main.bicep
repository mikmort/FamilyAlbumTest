// Main Bicep template for Family Album Application
// Optimized for: East US, 40GB storage, ~20 users, MSA authentication

targetScope = 'subscription'

@description('Environment name (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = 'prod'

@description('Primary Azure region')
param location string = 'eastus'

@description('SQL Server admin username')
@secure()
param sqlAdminUsername string

@description('SQL Server admin password')
@secure()
param sqlAdminPassword string

@description('Base name for resources')
param baseName string = 'familyalbum'

// Generate unique suffix for resources that need global uniqueness
var uniqueSuffix = uniqueString(subscription().subscriptionId, baseName, environment)
var resourceGroupName = '${baseName}-${environment}-rg'

// Resource Group
resource resourceGroup 'Microsoft.Resources/resourceGroups@2021-04-01' = {
  name: resourceGroupName
  location: location
  tags: {
    Application: 'FamilyAlbum'
    Environment: environment
    ManagedBy: 'Bicep'
  }
}

// Deploy core infrastructure
module infrastructure 'modules/infrastructure.bicep' = {
  name: 'infrastructure-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    baseName: baseName
    uniqueSuffix: uniqueSuffix
    sqlAdminUsername: sqlAdminUsername
    sqlAdminPassword: sqlAdminPassword
  }
}

// Deploy static web app
module staticWebApp 'modules/staticwebapp.bicep' = {
  name: 'staticwebapp-deployment'
  scope: resourceGroup
  params: {
    location: location
    environment: environment
    baseName: baseName
    sqlServerFqdn: infrastructure.outputs.sqlServerFqdn
    sqlDatabaseName: infrastructure.outputs.sqlDatabaseName
    storageAccountName: infrastructure.outputs.storageAccountName
    storageContainerName: infrastructure.outputs.storageContainerName
  }
}

// Outputs
output resourceGroupName string = resourceGroupName
output sqlServerName string = infrastructure.outputs.sqlServerName
output sqlServerFqdn string = infrastructure.outputs.sqlServerFqdn
output sqlDatabaseName string = infrastructure.outputs.sqlDatabaseName
output storageAccountName string = infrastructure.outputs.storageAccountName
output storageContainerName string = infrastructure.outputs.storageContainerName
output staticWebAppUrl string = staticWebApp.outputs.staticWebAppUrl
output staticWebAppName string = staticWebApp.outputs.staticWebAppName
