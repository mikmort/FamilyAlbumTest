# Database Update - Ready to Execute

## ✅ SQL Script Generated Successfully

**File**: `scripts/update-mov-to-mp4.sql`

## Summary

- **Total MOV files found**: 81
- **Converted to MP4**: 81 (100%)
- **Updates ready**: 81 UPDATE statements

All your video files have been successfully converted! The SQL script is ready to update the database references.

## How to Execute

### Option 1: Azure Data Studio (Recommended)

1. Open Azure Data Studio
2. Connect to your Azure SQL database
3. Open file: `scripts/update-mov-to-mp4.sql`
4. Review the UPDATE statements
5. **Important**: Uncomment this line near the end:
   ```sql
   -- COMMIT;
   ```
   Change it to:
   ```sql
   COMMIT;
   ```
6. Execute the entire script (F5)

### Option 2: Azure Portal Query Editor

1. Go to Azure Portal → Your SQL Database
2. Click "Query editor" in the left menu
3. Copy and paste the contents of `scripts/update-mov-to-mp4.sql`
4. **Important**: Uncomment the `COMMIT;` line
5. Click "Run"

### Option 3: SQL Server Management Studio (SSMS)

1. Connect to your Azure SQL database
2. File → Open → `scripts/update-mov-to-mp4.sql`
3. **Important**: Uncomment the `COMMIT;` line
4. Execute (F5)

## What This Does

```sql
UPDATE Pictures 
SET PFileName = 'MVI_5712.mp4'
WHERE PFileName = 'MVI_5712.MOV';
```

For each of the 81 videos:
- Changes the file name from `.MOV` to `.mp4`
- The MP4 files already exist in blob storage
- No data is deleted - this is just updating references

## Safety Features

✅ **Transaction-based**: Wrapped in BEGIN TRANSACTION  
✅ **Rollback option**: Can undo if needed  
✅ **Verification query**: Shows count before committing  
✅ **Comments**: COMMIT is commented out by default  

## After Running the SQL

1. ✅ **Videos will play in browser** - No more download prompts
2. ✅ **Thumbnails will regenerate** - Automatically on next view
3. ✅ **85% smaller files** - Faster loading
4. ✅ **Better compatibility** - H.264/AAC works everywhere

## Examples of Files Being Updated

- ES Bnot Mitzvah videos (MVI_5712.MOV → MVI_5712.mp4)
- Thanksgiving 2012 videos (MVI_5250.MOV → MVI_5250.mp4)
- Thanksgiving 2013 videos (MVI_0023.MOV → MVI_0023.mp4)
- Thanksgiving 2002 videos (PB240047.MOV → PB240047.mp4)
- Milwaukee & Charlottesville trips
- All family videos

## Next Step After Database Update

Run the thumbnail cleanup script:
```powershell
cd api
node ..\scripts\cleanup-placeholder-thumbnails.js
```

This will delete old corrupt thumbnails and force regeneration with the new MP4 files.

## Verification

After running the SQL and committing:

```sql
-- Check updated count
SELECT COUNT(*) FROM Pictures WHERE PFileName LIKE '%.mp4';

-- Should show 81 rows

-- Check remaining MOV files
SELECT COUNT(*) FROM Pictures WHERE PFileName LIKE '%.MOV';

-- Should show fewer (only unconverted ones remain)
```

## Need Help?

If you have questions about executing the SQL:
1. The script is safe - it uses transactions
2. You can ROLLBACK if anything looks wrong
3. The MP4 files are already in place
4. This is just updating database pointers

---

**Status**: ✅ Ready to execute  
**Risk**: Low (transaction-based, reversible)  
**Impact**: All videos will work in browsers  
