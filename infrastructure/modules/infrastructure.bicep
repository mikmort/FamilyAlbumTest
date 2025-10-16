// Infrastructure module - SQL Database and Storage Account

@description('Primary Azure region')
param location string

@description('Environment name')
param environment string

@description('Base name for resources')
param baseName string

@description('Unique suffix for global resources')
param uniqueSuffix string

@description('SQL Server admin username')
@secure()
param sqlAdminUsername string

@description('SQL Server admin password')
@secure()
param sqlAdminPassword string

// SQL Server
var sqlServerName = '${baseName}-${environment}-sql-${uniqueSuffix}'
var sqlDatabaseName = 'FamilyAlbum'

resource sqlServer 'Microsoft.Sql/servers@2023-05-01-preview' = {
  name: sqlServerName
  location: location
  tags: {
    Application: 'FamilyAlbum'
    Environment: environment
  }
  properties: {
    administratorLogin: sqlAdminUsername
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// SQL Server Firewall - Allow Azure Services
resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// SQL Server Firewall - Allow all (for development - restrict in production)
// TODO: Replace with specific IP ranges in production
resource sqlFirewallAll 'Microsoft.Sql/servers/firewallRules@2023-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAll'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Azure SQL Database (Serverless) - Optimized for 20 users
resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-05-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  tags: {
    Application: 'FamilyAlbum'
    Environment: environment
  }
  sku: {
    name: 'GP_S_Gen5'
    tier: 'GeneralPurpose'
    family: 'Gen5'
    capacity: 2 // Max vCores (can scale down to 0.5)
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 10737418240 // 10 GB (sufficient for metadata, actual media in blob storage)
    catalogCollation: 'SQL_Latin1_General_CP1_CI_AS'
    zoneRedundant: false
    readScale: 'Disabled'
    autoPauseDelay: 60 // Auto-pause after 60 minutes of inactivity
    requestedBackupStorageRedundancy: 'Local'
    isLedgerOn: false
    minCapacity: json('0.5') // Min vCores when active
  }
}

// Storage Account - Optimized for 40GB media storage
// Storage account names must be 3-24 chars, lowercase letters and numbers only
var storageAccountName = toLower(take('fam${environment}${uniqueSuffix}', 24))
var containerName = 'family-album-media'

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: {
    Application: 'FamilyAlbum'
    Environment: environment
  }
  sku: {
    name: 'Standard_LRS' // Locally Redundant Storage for cost optimization
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot' // Hot tier for frequently accessed photos
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false // Private by default
    allowSharedKeyAccess: true
    networkAcls: {
      defaultAction: 'Allow' // TODO: Restrict in production
      bypass: 'AzureServices'
    }
  }
}

// Blob Service
resource blobService 'Microsoft.Storage/storageAccounts/blobServices@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: [
        {
          allowedOrigins: [
            '*' // TODO: Restrict to specific domains in production
          ]
          allowedMethods: [
            'GET'
            'POST'
            'PUT'
            'DELETE'
            'OPTIONS'
          ]
          allowedHeaders: [
            '*'
          ]
          exposedHeaders: [
            '*'
          ]
          maxAgeInSeconds: 3600
        }
      ]
    }
    deleteRetentionPolicy: {
      enabled: true
      days: 7 // Keep deleted files for 7 days
    }
  }
}

// Container for media files
resource mediaContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: containerName
  properties: {
    publicAccess: 'None'
  }
}

// Container for thumbnails
resource thumbnailContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-01-01' = {
  parent: blobService
  name: 'thumbnails'
  properties: {
    publicAccess: 'None'
  }
}

// Lifecycle Management - Move old files to Cool tier after 90 days
resource lifecyclePolicy 'Microsoft.Storage/storageAccounts/managementPolicies@2023-01-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    policy: {
      rules: [
        {
          enabled: true
          name: 'MoveOldMediaToCool'
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                'media/'
              ]
            }
            actions: {
              baseBlob: {
                tierToCool: {
                  daysAfterModificationGreaterThan: 90
                }
                tierToArchive: {
                  daysAfterModificationGreaterThan: 365
                }
              }
            }
          }
        }
        {
          enabled: true
          name: 'DeleteOldThumbnails'
          type: 'Lifecycle'
          definition: {
            filters: {
              blobTypes: [
                'blockBlob'
              ]
              prefixMatch: [
                'thumbnails/temp_'
              ]
            }
            actions: {
              baseBlob: {
                delete: {
                  daysAfterModificationGreaterThan: 7
                }
              }
            }
          }
        }
      ]
    }
  }
}

// Outputs
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output storageAccountName string = storageAccount.name
output storageAccountId string = storageAccount.id
output storageContainerName string = containerName
@secure()
output storageAccountKey string = storageAccount.listKeys().keys[0].value
