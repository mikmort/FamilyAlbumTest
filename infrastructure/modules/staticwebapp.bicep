// Static Web App module with MSA Authentication

@description('Primary Azure region')
param location string

@description('Environment name')
param environment string

@description('Base name for resources')
param baseName string

@description('SQL Server FQDN')
param sqlServerFqdn string

@description('SQL Database name')
param sqlDatabaseName string

@description('Storage Account name')
param storageAccountName string

@description('Storage Container name')
param storageContainerName string

// Static Web App - Free tier suitable for ~20 users
var staticWebAppName = '${baseName}-${environment}-app'

resource staticWebApp 'Microsoft.Web/staticSites@2023-01-01' = {
  name: staticWebAppName
  location: location
  tags: {
    Application: 'FamilyAlbum'
    Environment: environment
  }
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    repositoryUrl: 'https://github.com/mikmort/FamilyAlbumTest' // Update with your repo
    branch: 'main'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
    buildProperties: {
      appLocation: '/'
      apiLocation: ''
      outputLocation: '.next'
    }
  }
}

// Note: Authentication is configured via staticwebapp.config.json in the repo
// MSA authentication can be added through Azure Portal after deployment

// Custom domain (optional - commented out by default)
// resource staticWebAppCustomDomain 'Microsoft.Web/staticSites/customDomains@2023-01-01' = {
//   parent: staticWebApp
//   name: 'www.familyalbum.com'
//   properties: {}
// }

// Outputs
output staticWebAppName string = staticWebApp.name
output staticWebAppUrl string = 'https://${staticWebApp.properties.defaultHostname}'
output staticWebAppId string = staticWebApp.id
