# Rename URL-encoded blobs to use plain names
# This normalizes blob storage so all blobs use actual characters (apostrophes, spaces)

$accountName = "famprodgajerhxssqswm"
$containerName = "family-album-media"
$azPath = "C:\Program Files\Microsoft SDKs\Azure\CLI2\wbin\az.cmd"

Write-Output "=== Azure Blob Normalization Script ==="
Write-Output "Fetching blobs..."

# Get all blobs with encoded names
$blobs = & $azPath storage blob list --account-name $accountName --container-name $containerName --output json | ConvertFrom-Json
$encodedBlobs = $blobs | Where-Object { $_.name -match "%[0-9A-F]{2}" }

Write-Output "Found $($encodedBlobs.Count) blobs with URL-encoded names"

if ($encodedBlobs.Count -eq 0) {
    Write-Output "No blobs need renaming!"
    exit 0
}

# Show what will be renamed
$renamePairs = @()
foreach ($blob in $encodedBlobs) {
    $oldName = $blob.name
    $newName = [System.Web.HttpUtility]::UrlDecode($oldName)
    
    if ($oldName -ne $newName) {
        $renamePairs += @{
            Old = $oldName
            New = $newName
        }
        Write-Output "  $oldName -> $newName"
    }
}

if ($renamePairs.Count -eq 0) {
    Write-Output "No renames needed!"
    exit 0
}

# Confirm
Write-Output "`nRename $($renamePairs.Count) blobs?"
$confirm = Read-Host "Type 'yes' to proceed"

if ($confirm -ne "yes") {
    Write-Output "Cancelled"
    exit 0
}

# Rename by copy+delete
$success = 0
$fail = 0

foreach ($pair in $renamePairs) {
    Write-Output "Renaming: $($pair.Old)"
    
    # Copy - the source blob name in storage already has %27 and %20 as literal characters
    # So the URL should use the blob name as-is
    $sourceUrl = "https://$accountName.blob.core.windows.net/$containerName/$($pair.Old)"
    Write-Output "  Source URL: $sourceUrl"
    $copyOutput = & $azPath storage blob copy start --account-name $accountName --destination-blob $pair.New --destination-container $containerName --source-uri $sourceUrl 2>&1
    Write-Output "  Copy output: $copyOutput"
    
    if ($LASTEXITCODE -eq 0) {
        Start-Sleep -Seconds 2
        
        # Check if copy succeeded
        $exists = & $azPath storage blob exists --account-name $accountName --container-name $containerName --name $pair.New --query "exists" --output tsv 2>&1
        
        if ($exists -eq "true") {
            # Delete old
            & $azPath storage blob delete --account-name $accountName --container-name $containerName --name $pair.Old --output none 2>&1 | Out-Null
            
            if ($LASTEXITCODE -eq 0) {
                Write-Output "  Success"
                $success++
            } else {
                Write-Output "  Failed to delete old"
                $fail++
            }
        } else {
            Write-Output "  Copy failed"
            $fail++
        }
    } else {
        Write-Output "  Copy start failed"
        $fail++
    }
}

Write-Output "`n=== Summary ==="
Write-Output "Success: $success"
Write-Output "Failed: $fail"
