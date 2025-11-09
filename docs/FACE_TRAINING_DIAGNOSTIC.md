# Face Training 500 Error - Diagnostic Tools

## Problem
The face training feature shows: `Error: Failed to fetch tagged photos: 500 - Backend call failure`

## Diagnostic Tools Created

### 1. Debug Endpoint
**Location:** `/api/faces-tagged-photos-debug`

This is an enhanced version of the original endpoint with extensive logging at each step:
- Authorization check
- Database connectivity test
- Photo-person pair count
- Person counts query
- Sample photo retrieval
- SAS URL generation

### 2. Diagnostic Web Page
**Location:** `/public/debug-face-training.html`

Access at: `http://localhost:3000/debug-face-training.html` (or your deployed URL)

This page provides three tests:
1. **Test Original Endpoint** - Reproduces the 500 error
2. **Test Debug Endpoint** - Shows detailed step-by-step logging
3. **Test Auth Status** - Verifies database connectivity

## How to Use

### Step 1: Start Local Development Server
```powershell
# Terminal 1: Start Next.js
npm run dev

# Terminal 2: Start Azure Functions
cd api
func start
```

### Step 2: Access Diagnostic Page
Open: `http://localhost:3000/debug-face-training.html`

### Step 3: Run Tests
1. Click "Check Auth Status" - Should show you're authenticated
2. Click "Run Test" on the original endpoint - Will likely show 500 error
3. Click "Run Diagnostic" - Will show detailed logs of exactly where it fails

### Step 4: Analyze Results

The debug log will show each step:
- `START` - Request received
- `AUTH_CHECK_START` / `AUTH_CHECK_COMPLETE` - Authorization
- `DB_TEST_START` / `DB_TEST_COMPLETE` - Basic database connectivity
- `PHOTO_PAIRS_COUNT_START` / `PHOTO_PAIRS_COUNT_COMPLETE` - Count of tagged photos
- `PERSON_COUNTS_START` / `PERSON_COUNTS_COMPLETE` - Photos per person
- `SAMPLE_PHOTOS_START` / `SAMPLE_PHOTOS_COMPLETE` - Sample photo retrieval
- `SAS_URL_START` / `SAS_URL_COMPLETE` - SAS URL generation
- `FATAL_ERROR` - If something fails, shows exact error

## Common Issues to Look For

### Issue 1: Database Warmup
**Symptoms:** Error mentions "timeout" or "warming up"
**Solution:** Wait 30-60 seconds and try again

### Issue 2: Missing Environment Variables
**Symptoms:** Error in `SAS_URL_ERROR` about storage credentials
**Solution:** Check `api/local.settings.json` has correct Azure Storage credentials

### Issue 3: SQL Query Error
**Symptoms:** Error in database query steps with SQL syntax error
**Solution:** Check database schema matches expected structure

### Issue 4: No Tagged Photos
**Symptoms:** `NO_PAIRS_FOUND` or `NO_COUNTS_FOUND` in log
**Solution:** Ensure you have tagged photos in the database (NamePhoto table or Pictures.PPeopleList)

### Issue 5: Authorization Failed
**Symptoms:** `AUTH_FAILED` in log
**Solution:** Ensure user has "Full" or "Admin" role in Users table

## Next Steps After Diagnosis

Once you identify the exact failure point from the debug log:

1. **Share the full debug log** - Copy the entire JSON output from the debug endpoint
2. **Check Azure logs** - If deployed, check Application Insights or Function logs
3. **Verify data** - Query the database directly to verify tagged photos exist
4. **Test components individually** - Use the diagnostic tool to isolate the problem

## Manual Database Checks

If you want to manually verify the database:

```sql
-- Check if any people exist
SELECT COUNT(*) FROM NameEvent WHERE neType = 'N';

-- Check if any manual tags exist (NamePhoto table)
SELECT COUNT(*) FROM NamePhoto;

-- Check if any tags exist in PPeopleList field
SELECT COUNT(*) FROM Pictures WHERE PPeopleList IS NOT NULL AND PPeopleList != '';

-- Get sample of tagged photos
SELECT TOP 10 np.npFileName, ne.neName
FROM NamePhoto np
INNER JOIN NameEvent ne ON np.npID = ne.ID
WHERE ne.neType = 'N';
```

## Cleanup

After diagnosis, you can:
- Keep the debug endpoint for future troubleshooting
- Remove it if no longer needed:
  - Delete `/api/faces-tagged-photos-debug/` folder
  - Delete `/public/debug-face-training.html`
