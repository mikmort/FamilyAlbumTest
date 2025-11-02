# Fix corrupted file paths in the database
# Issue: Paths have "B:/Family Album/" prefix and duplicate directories

param(
    [string]$DatabasePath = "C:\Users\mikmort\OneDrive\Desktop\family_album.db",
    [switch]$DryRun = $false
)

Write-Host "🔧 Fixing corrupted file paths in database" -ForegroundColor Cyan
Write-Host "Database: $DatabasePath" -ForegroundColor Gray
Write-Host ""

if (-not (Test-Path $DatabasePath)) {
    Write-Host "❌ Database not found: $DatabasePath" -ForegroundColor Red
    exit 1
}

# Load SQLite
Add-Type -Path "C:\Program Files\PackageManagement\NuGet\Packages\Microsoft.Data.Sqlite.Core.8.0.0\lib\net8.0\Microsoft.Data.Sqlite.dll"
$connectionString = "Data Source=$DatabasePath"
$connection = New-Object Microsoft.Data.Sqlite.SqliteConnection($connectionString)
$connection.Open()

try {
    # First, check the current state
    Write-Host "📊 Analyzing current paths..." -ForegroundColor Yellow
    
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = @"
SELECT 
    COUNT(*) as Total,
    SUM(CASE WHEN PFileName LIKE '%:%' THEN 1 ELSE 0 END) as WithDriveLetter,
    SUM(CASE WHEN PFileName LIKE '%/%/%' AND 
        (INSTR(SUBSTR(PFileName, INSTR(PFileName, '/') + 1), SUBSTR(PFileName, 1, INSTR(PFileName, '/') - 1)) > 0)
        THEN 1 ELSE 0 END) as WithDuplicatePath
FROM Media
"@
    
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        $total = $reader["Total"]
        $withDrive = $reader["WithDriveLetter"]
        $withDup = $reader["WithDuplicatePath"]
        
        Write-Host "  Total media files: $total" -ForegroundColor White
        Write-Host "  Files with drive letters: $withDrive" -ForegroundColor $(if ($withDrive -gt 0) { "Red" } else { "Green" })
        Write-Host "  Files with duplicate paths: $withDup" -ForegroundColor $(if ($withDup -gt 0) { "Red" } else { "Green" })
        Write-Host ""
    }
    $reader.Close()
    
    # Show some examples
    Write-Host "📝 Examples of problematic paths:" -ForegroundColor Yellow
    $cmd.CommandText = "SELECT PFileName FROM Media WHERE PFileName LIKE '%:%' OR PFileName LIKE '%Events/%Events/%' LIMIT 5"
    $reader = $cmd.ExecuteReader()
    while ($reader.Read()) {
        Write-Host "  $($reader['PFileName'])" -ForegroundColor Gray
    }
    $reader.Close()
    Write-Host ""
    
    if ($DryRun) {
        Write-Host "🔍 DRY RUN MODE - No changes will be made" -ForegroundColor Yellow
        Write-Host ""
    }
    
    # Fix 1: Remove drive letters (B:, C:, D:, etc.)
    Write-Host "🔨 Step 1: Removing drive letters..." -ForegroundColor Cyan
    $cmd.CommandText = @"
UPDATE Media
SET PFileName = CASE
    WHEN PFileName LIKE '%:%' THEN LTRIM(SUBSTR(PFileName, INSTR(PFileName, ':') + 1), '/\')
    ELSE PFileName
END
WHERE PFileName LIKE '%:%'
"@
    
    if (-not $DryRun) {
        $affected = $cmd.ExecuteNonQuery()
        Write-Host "  ✅ Fixed $affected files" -ForegroundColor Green
    } else {
        Write-Host "  Would fix files with drive letters" -ForegroundColor Gray
    }
    
    # Fix 2: Replace backslashes with forward slashes
    Write-Host "🔨 Step 2: Normalizing path separators..." -ForegroundColor Cyan
    $cmd.CommandText = "UPDATE Media SET PFileName = REPLACE(PFileName, '\', '/') WHERE PFileName LIKE '%\%'"
    
    if (-not $DryRun) {
        $affected = $cmd.ExecuteNonQuery()
        Write-Host "  ✅ Fixed $affected files" -ForegroundColor Green
    } else {
        Write-Host "  Would normalize path separators" -ForegroundColor Gray
    }
    
    # Fix 3: Remove "Family Album/" prefix
    Write-Host "🔨 Step 3: Removing 'Family Album/' prefix..." -ForegroundColor Cyan
    $cmd.CommandText = "UPDATE Media SET PFileName = SUBSTR(PFileName, LENGTH('Family Album/') + 1) WHERE PFileName LIKE 'Family Album/%'"
    
    if (-not $DryRun) {
        $affected = $cmd.ExecuteNonQuery()
        Write-Host "  ✅ Fixed $affected files" -ForegroundColor Green
    } else {
        Write-Host "  Would remove 'Family Album/' prefix" -ForegroundColor Gray
    }
    
    # Fix 4: Remove duplicate directory paths
    Write-Host "🔨 Step 4: Fixing duplicate directory paths..." -ForegroundColor Cyan
    Write-Host "  This is complex - checking for specific patterns..." -ForegroundColor Gray
    
    # Get all files to check for duplicates
    $cmd.CommandText = "SELECT PID, PFileName FROM Media"
    $reader = $cmd.ExecuteReader()
    $filesToFix = @()
    
    while ($reader.Read()) {
        $pid = $reader["PID"]
        $path = $reader["PFileName"]
        
        # Check if path has duplicate segments
        # Example: "Events/Birthdays/Party/Events/Birthdays/Party/photo.jpg"
        $parts = $path -split '/'
        
        if ($parts.Length -gt 3) {
            $halfway = [Math]::Floor($parts.Length / 2)
            $firstHalf = $parts[0..($halfway-1)] -join '/'
            $secondHalf = $parts[$halfway..($parts.Length-1)] -join '/'
            
            # Check if second half starts with first half
            if ($secondHalf.StartsWith($firstHalf + '/')) {
                $fixedPath = $secondHalf
                $filesToFix += @{PID = $pid; OldPath = $path; NewPath = $fixedPath}
            }
        }
    }
    $reader.Close()
    
    Write-Host "  Found $($filesToFix.Count) files with duplicate paths" -ForegroundColor Yellow
    
    if ($filesToFix.Count -gt 0 -and -not $DryRun) {
        $updateCmd = $connection.CreateCommand()
        $updateCmd.CommandText = "UPDATE Media SET PFileName = @newPath WHERE PID = @pid"
        $updateCmd.Parameters.Add((New-Object Microsoft.Data.Sqlite.SqliteParameter("@newPath", [string]"")))
        $updateCmd.Parameters.Add((New-Object Microsoft.Data.Sqlite.SqliteParameter("@pid", [int]0)))
        
        foreach ($file in $filesToFix) {
            $updateCmd.Parameters["@newPath"].Value = $file.NewPath
            $updateCmd.Parameters["@pid"].Value = $file.PID
            $updateCmd.ExecuteNonQuery() | Out-Null
        }
        
        Write-Host "  ✅ Fixed $($filesToFix.Count) files" -ForegroundColor Green
    }
    
    # Show final state
    Write-Host ""
    Write-Host "📊 Final state:" -ForegroundColor Yellow
    $cmd.CommandText = @"
SELECT 
    COUNT(*) as Total,
    SUM(CASE WHEN PFileName LIKE '%:%' THEN 1 ELSE 0 END) as WithDriveLetter,
    SUM(CASE WHEN PFileName LIKE '%Events/%Events/%' OR PFileName LIKE '%Birthdays/%Birthdays/%' THEN 1 ELSE 0 END) as WithDuplicatePath
FROM Media
"@
    
    $reader = $cmd.ExecuteReader()
    if ($reader.Read()) {
        $total = $reader["Total"]
        $withDrive = $reader["WithDriveLetter"]
        $withDup = $reader["WithDuplicatePath"]
        
        Write-Host "  Total media files: $total" -ForegroundColor White
        Write-Host "  Files with drive letters: $withDrive" -ForegroundColor $(if ($withDrive -gt 0) { "Red" } else { "Green" })
        Write-Host "  Files with duplicate paths: $withDup" -ForegroundColor $(if ($withDup -gt 0) { "Red" } else { "Green" })
    }
    $reader.Close()
    
    # Show some examples of fixed paths
    if (-not $DryRun) {
        Write-Host ""
        Write-Host "📝 Examples of fixed paths:" -ForegroundColor Yellow
        $cmd.CommandText = "SELECT PFileName FROM Media LIMIT 10"
        $reader = $cmd.ExecuteReader()
        while ($reader.Read()) {
            Write-Host "  $($reader['PFileName'])" -ForegroundColor Gray
        }
        $reader.Close()
    }
    
} finally {
    $connection.Close()
}

Write-Host ""
if ($DryRun) {
    Write-Host "✅ Dry run complete. Run without -DryRun to apply fixes." -ForegroundColor Cyan
} else {
    Write-Host "✅ Database paths fixed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "  1. Upload the fixed database to Azure SQL" -ForegroundColor White
    Write-Host "  2. Restart the Azure Functions app" -ForegroundColor White
}
