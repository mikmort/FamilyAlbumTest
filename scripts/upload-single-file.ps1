# Upload a single file to Azure Blob Storage
param(
    [Parameter(Mandatory=$true)]
    [string]$FilePath,
    
    [Parameter(Mandatory=$true)]
    [string]$BlobPath,
    
    [Parameter(Mandatory=$false)]
    [string]$ConnectionString
)

Write-Host "=== Upload Single File to Azure Blob Storage ===" -ForegroundColor Cyan
Write-Host ""

# Try to get connection string from multiple sources
if (-not $ConnectionString) {
    # Try local.settings.json first
    $localSettingsPath = "../api/local.settings.json"
    if (Test-Path $localSettingsPath) {
        Write-Host "Loading from local.settings.json..." -ForegroundColor Yellow
        $settings = Get-Content $localSettingsPath | ConvertFrom-Json
        $accountName = $settings.Values.AZURE_STORAGE_ACCOUNT
        $accountKey = $settings.Values.AZURE_STORAGE_KEY
        $containerName = $settings.Values.AZURE_STORAGE_CONTAINER
        
        if ($accountName -and $accountKey) {
            $ConnectionString = "DefaultEndpointsProtocol=https;AccountName=$accountName;AccountKey=$accountKey;EndpointSuffix=core.windows.net"
        }
    }
    
    # Try Azure CLI
    if (-not $ConnectionString) {
        Write-Host "Trying to get connection string from Azure CLI..." -ForegroundColor Yellow
        try {
            # Check if az cli is available
            $null = Get-Command az -ErrorAction Stop
            
            # Try to find the storage account
            $storageAccounts = az storage account list --query "[?starts_with(name, 'fam')]" | ConvertFrom-Json
            if ($storageAccounts.Count -gt 0) {
                $storageAccount = $storageAccounts[0]
                Write-Host "Found storage account: $($storageAccount.name)" -ForegroundColor Green
                
                $ConnectionString = az storage account show-connection-string `
                    --name $storageAccount.name `
                    --resource-group $storageAccount.resourceGroup `
                    --output tsv
                
                $containerName = "family-album-media"
            }
        } catch {
            Write-Host "  Azure CLI not available or not logged in" -ForegroundColor Yellow
        }
    }
    
    # Prompt user for connection string
    if (-not $ConnectionString) {
        Write-Host ""
        Write-Host "Please provide the Azure Storage connection string." -ForegroundColor Yellow
        Write-Host "You can find it in Azure Portal -> Storage Account -> Access keys" -ForegroundColor Yellow
        Write-Host ""
        $ConnectionString = Read-Host "Connection String"
    }
}

if (-not $ConnectionString) {
    Write-Host "ERROR: No connection string provided" -ForegroundColor Red
    exit 1
}

# Parse connection string
if ($ConnectionString -match 'AccountName=([^;]+)') {
    $accountName = $Matches[1]
}
if ($ConnectionString -match 'AccountKey=([^;]+)') {
    $accountKey = $Matches[1]
}

if (-not $containerName) {
    $containerName = "family-album-media"
}

Write-Host "Using Storage Account: $accountName" -ForegroundColor Green
Write-Host "Container: $containerName" -ForegroundColor Green
Write-Host ""

# Check if file exists
if (-not (Test-Path $FilePath)) {
    Write-Host "ERROR: File not found: $FilePath" -ForegroundColor Red
    exit 1
}

$fileInfo = Get-Item $FilePath
Write-Host "File to upload:" -ForegroundColor Green
Write-Host "  Local path: $FilePath"
Write-Host "  File size: $($fileInfo.Length) bytes"
Write-Host "  Blob path: $BlobPath"
Write-Host ""

# Load Az.Storage module
Write-Host "Loading Azure Storage module..." -ForegroundColor Yellow
try {
    Import-Module Az.Storage -ErrorAction Stop
    Write-Host "  Module loaded successfully" -ForegroundColor Green
} catch {
    Write-Host "  Az.Storage module not found. Installing..." -ForegroundColor Yellow
    Install-Module -Name Az.Storage -Scope CurrentUser -Force -AllowClobber
    Import-Module Az.Storage
}

# Create storage context
Write-Host "Connecting to Azure Storage..." -ForegroundColor Yellow
try {
    $ctx = New-AzStorageContext -ConnectionString $ConnectionString
    Write-Host "  Connected successfully" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to connect to Azure Storage" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}

# Determine content type
$contentType = "application/octet-stream"
$extension = $fileInfo.Extension.ToLower()
$contentTypes = @{
    ".jpg" = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png" = "image/png"
    ".gif" = "image/gif"
    ".bmp" = "image/bmp"
    ".mov" = "video/quicktime"
    ".mp4" = "video/mp4"
    ".avi" = "video/x-msvideo"
}
if ($contentTypes.ContainsKey($extension)) {
    $contentType = $contentTypes[$extension]
}

Write-Host ""
Write-Host "Uploading to container: $containerName" -ForegroundColor Yellow
Write-Host "Content-Type: $contentType" -ForegroundColor Yellow

# Upload the file
try {
    $uploadParams = @{
        File = $FilePath
        Container = $containerName
        Blob = $BlobPath
        Context = $ctx
        Properties = @{
            ContentType = $contentType
        }
        Force = $true
    }
    
    $result = Set-AzStorageBlobContent @uploadParams
    
    Write-Host ""
    Write-Host "✅ Upload successful!" -ForegroundColor Green
    Write-Host "Blob URL: $($result.ICloudBlob.Uri.AbsoluteUri)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "You can now test the file at:" -ForegroundColor Yellow
    $encodedPath = ($BlobPath -split '/') | ForEach-Object { [System.Web.HttpUtility]::UrlEncode($_) } | Join-String -Separator '/'
    Write-Host "https://lemon-tree-0f8fd281e.5.azurestaticapps.net/api/media/$encodedPath" -ForegroundColor Cyan
    
} catch {
    Write-Host ""
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    Write-Host $_.Exception.Message
    exit 1
}
