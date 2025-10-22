# Data Reimport Guide: Fixing PPeopleList ID Mismatch

## Problem

The current Azure SQL database has **mismatched IDs** between:
- **SQLite (source)**: Original people/event IDs (e.g., ID 195 = "Budie Grossman")
- **Azure SQL (current)**: Auto-generated IDs (IDENTITY 1,1) that don't match SQLite

**Impact**: 
- `Pictures.PPeopleList` contains SQLite IDs (e.g., "195,553,318")
- Azure SQL `NameEvent` table has different IDs (e.g., ID 1 = "Budie Grossman")
- Result: TaggedPeople displays wrong names or blanks

## Example Problem

**DSC04780 (1).JPG**:
- `PPeopleList` (SQLite IDs): `195,553,318,551,507,281,462,425,552`
- Expected to show: Budie Grossman, [Event], Jigger, [Event], Scott Jenkins, Helen Eitelberg, Shoshana Tieyah, Richard Grossman, [Event]
- Actually shows: Wrong names because Azure IDs don't match

## Solution: Reimport with ID Preservation

Use `IDENTITY_INSERT` to preserve original SQLite IDs during Azure SQL import.

## Steps

### 1. Export from SQLite

Run the PowerShell script to export CSV files:

```powershell
cd C:\Users\jb_mo\OneDrive\Documents\FamilyAlbumTest\scripts
.\export-from-sqlite.ps1
```

This creates:
- `C:\Temp\people_export.csv` - All people with original IDs
- `C:\Temp\events_export.csv` - All events with original IDs
- `C:\Temp\pictures_export.csv` - All pictures with PPeopleList intact
- `C:\Temp\namephoto_export.csv` - All photo associations

**Prerequisites**: sqlite3.exe must be in PATH or installed

### 2. Verify CSV Files

Check that CSV files were created and contain data:

```powershell
Get-Content C:\Temp\people_export.csv | Select-Object -First 5
```

### 3. Back Up Azure SQL Data

Before running the reimport, backup your current Azure SQL database:

```sql
-- In Azure Data Studio or SSMS, create a backup
```

Or use Azure Portal → SQL Database → Backups

### 4. Run Reimport Script

Open `C:\Users\jb_mo\OneDrive\Documents\FamilyAlbumTest\database\reimport-with-identity-preservation.sql` in Azure Data Studio or SQL Server Management Studio.

**Important**: 
- Update the CSV file paths in the script if you used a different output directory
- Review the script to understand what it does
- **This will DELETE all existing data** - make sure you've backed up first

Run the script:

```sql
-- Copy entire script to Azure Data Studio
-- Execute
```

### 5. Verify Results

After the script completes, verify the data:

```sql
-- Check person count
SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N';

-- Check that specific IDs exist
SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425);

-- Check a picture's PPeopleList resolves correctly
SELECT p.PFileName, p.PPeopleList, 
       STRING_AGG(ne.neName, ', ') WITHIN GROUP (ORDER BY ne.ID) as TaggedNames
FROM dbo.Pictures p
CROSS APPLY STRING_SPLIT(p.PPeopleList, ',') AS ids
LEFT JOIN dbo.NameEvent ne ON ne.ID = CAST(TRIM(ids.value) AS INT)
WHERE p.PFileName LIKE '%DSC04780%'
GROUP BY p.PFileName, p.PPeopleList;
```

### 6. Clear Application Cache

If the app caches people data, clear it and refresh:

```powershell
# If using Azure Functions, restart them
az functionapp restart --resource-group <your-rg> --name <your-function-app>
```

Or refresh the browser with Ctrl+F5 to clear browser cache.

### 7. Test Results

1. Go to the application
2. Open the DSC04780 picture in media detail view
3. Verify `TaggedPeople` shows:
   - Budie Grossman (first)
   - Jigger (second)
   - Scott Jenkins (third)
   - Helen Eitelberg (fourth)
   - Shoshana Tieyah (fifth)
   - Richard Grossman (last)

## Key Concept: IDENTITY_INSERT

### How It Works

```sql
-- Normal: IDENTITY_INSERT OFF
INSERT INTO dbo.NameEvent (neName, neType) VALUES ('John', 'N');
-- Result: Gets auto-generated ID (e.g., 1, 2, 3...)

-- With preservation: IDENTITY_INSERT ON
SET IDENTITY_INSERT dbo.NameEvent ON;
INSERT INTO dbo.NameEvent (ID, neName, neType) VALUES (195, 'Budie Grossman', 'N');
-- Result: Inserts with exact ID 195
SET IDENTITY_INSERT dbo.NameEvent OFF;
```

### Why It Matters

- PPeopleList references specific IDs (195, 318, 507, etc.)
- If Azure generates new IDs (1, 2, 3...), references break
- IDENTITY_INSERT preserves the original IDs
- References stay valid ✓

## Rollback Plan

If something goes wrong:

1. **Restore from backup**:
   - Azure Portal → SQL Database → Restore point → Restore

2. **Or re-import from current code**:
   - Run the original migration script
   - Be aware it will re-create the ID mismatch

## Troubleshooting

### CSV files not found
- Make sure sqlite3 is in PATH: `sqlite3 --version`
- Check output directory exists: `C:\Temp\`

### BULK INSERT fails
- Verify CSV file paths are correct in SQL script
- Check CSV has headers (FIRSTROW = 2 skips header)
- Ensure file format is UTF-8

### Identity constraint errors
- Make sure you ran the DELETE statements first
- Check DBCC CHECKIDENT line executed successfully

### Data doesn't update on website
- Clear browser cache (Ctrl+Shift+Delete)
- Restart Azure Function App
- Clear any application caches

## Files Involved

| File | Purpose |
|------|---------|
| `C:\Family Album\FamilyAlbum.db` | Source SQLite database |
| `scripts/export-from-sqlite.ps1` | PowerShell export script |
| `database/reimport-with-identity-preservation.sql` | SQL reimport script |
| `C:\Temp\*.csv` | Temporary export files |

## Timeline

- **Export**: 5 minutes
- **Backup Azure SQL**: 2 minutes  
- **Reimport**: 5-10 minutes
- **Verification**: 5 minutes
- **Total**: ~20 minutes

## Questions?

If something doesn't work:
1. Check script output for errors
2. Verify CSV file contents
3. Check Azure SQL error logs
4. Restore from backup and try again
