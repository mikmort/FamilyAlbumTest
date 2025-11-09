# Face Training 500 Error - Debugging Summary

## Problem
Face training shows: **"Error: Failed to fetch tagged photos: 500 - Backend call failure"**

## Solution: Comprehensive Diagnostic Tools

I've created a complete diagnostic system to identify the exact cause of the 500 error.

## Tools Created

### 1. Debug API Endpoint
**Path:** `/api/faces-tagged-photos-debug`

Enhanced version of the original endpoint with step-by-step logging:
- ✓ Authorization verification
- ✓ Database connectivity test  
- ✓ Photo-person pair counting
- ✓ Person counts aggregation
- ✓ Sample photo retrieval
- ✓ SAS URL generation test

Each step logs detailed information about success/failure.

### 2. Web-Based Test Page
**Path:** `/public/debug-face-training.html`

Interactive diagnostic page with three tests:
1. **Original Endpoint Test** - Reproduces the 500 error
2. **Debug Endpoint Test** - Shows detailed diagnostic information
3. **Auth Status Check** - Verifies authentication and database

### 3. PowerShell Test Script
**Path:** `/scripts/test-face-training-diagnostic.ps1`

Command-line diagnostic tool that:
- Tests all three endpoints
- Shows color-coded results
- Saves full diagnostic output to JSON
- Works with both local development and deployed environments

## How to Run Diagnostics

### Option A: Web Interface (Easiest)

1. Make sure your app is running (local or deployed)
2. Navigate to: `http://localhost:3000/debug-face-training.html` (or your deployed URL)
3. Click the test buttons and review results

### Option B: PowerShell Script

```powershell
# Run from project root
.\scripts\test-face-training-diagnostic.ps1
```

This will:
- Test auth status
- Try the original endpoint (reproduce error)
- Run full diagnostic with detailed logging
- Save results to `debug-response.json`

### Option C: Direct API Call

```powershell
# Using PowerShell
$response = Invoke-RestMethod -Uri "http://localhost:7071/api/faces-tagged-photos-debug" -Method GET
$response | ConvertTo-Json -Depth 10
```

```bash
# Using curl
curl http://localhost:7071/api/faces-tagged-photos-debug
```

## What to Look For

The debug log will identify exactly where the failure occurs:

### Common Issues

1. **Database Warmup**
   - Log shows: Timeout or warmup error
   - Solution: Wait 30-60 seconds, retry

2. **Missing Storage Credentials**
   - Log shows: `SAS_URL_ERROR` 
   - Solution: Check `AZURE_STORAGE_ACCOUNT` and `AZURE_STORAGE_KEY` in environment

3. **No Tagged Photos**
   - Log shows: `NO_PAIRS_FOUND` or `NO_COUNTS_FOUND`
   - Solution: Tag some photos first (NamePhoto table or Pictures.PPeopleList)

4. **SQL Query Error**
   - Log shows: Database query failure with SQL error message
   - Solution: Verify database schema matches expected structure

5. **Authorization Issue**
   - Log shows: `AUTH_FAILED` or insufficient permissions
   - Solution: Ensure user has "Full" or "Admin" role

## Example Debug Output

```json
{
  "success": true,
  "diagnostic": true,
  "summary": {
    "peopleInDatabase": 15,
    "totalTaggedPairs": 1250,
    "personsWithPhotos": 12,
    "samplePhotosReturned": 10,
    "sasUrlGenerated": true,
    "sasError": null
  },
  "debugLog": [
    { "step": "START", "timestamp": "2025-11-09T...", "data": {...} },
    { "step": "AUTH_CHECK_COMPLETE", "data": { "authorized": true } },
    { "step": "DB_TEST_COMPLETE", "data": { "peopleCount": 15 } },
    ...
  ]
}
```

## Files Created

1. `/api/faces-tagged-photos-debug/index.js` - Debug endpoint
2. `/api/faces-tagged-photos-debug/function.json` - Endpoint config
3. `/public/debug-face-training.html` - Web test interface
4. `/scripts/test-face-training-diagnostic.ps1` - PowerShell test script
5. `/docs/FACE_TRAINING_DIAGNOSTIC.md` - Full documentation
6. `/docs/FACE_TRAINING_DEBUG_SUMMARY.md` - This file

## Next Steps

1. **Run the diagnostic** using any of the three methods above
2. **Identify the failure point** from the debug log
3. **Share the debug log** if you need help interpreting results
4. **Fix the root cause** based on the specific error found

## Clean Up

After fixing the issue, you can optionally remove the diagnostic tools:

```powershell
# Remove debug endpoint
Remove-Item -Recurse api/faces-tagged-photos-debug

# Remove web test page  
Remove-Item public/debug-face-training.html

# Keep the PowerShell script for future use
# Keep the docs for reference
```

Or keep them for future troubleshooting!

## Need Help?

If the diagnostic doesn't make the issue clear:

1. Run the PowerShell script: `.\scripts\test-face-training-diagnostic.ps1`
2. Share the contents of `debug-response.json`
3. Include any error messages from the debug log
4. Note which step in the debug log shows the failure
