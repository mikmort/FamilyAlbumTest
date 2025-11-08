# Database Warmup Error Handling Fix

## Problem Statement

When users browse to the Family Album site (mortonfamilyalbum.com) and the Azure SQL Database has not been warmed up (which can take up to 60 seconds for serverless tier), an error was showing as "Access Denied". This was incorrect because it's not a permissions issue, but rather the database is auto-resuming from a paused state.

## Solution

This fix implements proper detection and handling of database warmup scenarios with clear user feedback.

## Technical Implementation

### 1. Database Module Enhancement (`api/shared/db.js`)

**Added DatabaseWarmupError Class:**
```javascript
class DatabaseWarmupError extends Error {
  constructor(message, originalError) {
    super(message);
    this.name = 'DatabaseWarmupError';
    this.originalError = originalError;
    this.isWarmupError = true;
  }
}
```

**Added Warmup Error Detection:**
The `isDatabaseWarmupError()` function detects common patterns that indicate database is warming up:
- Connection timeouts (ETIMEOUT, timeout)
- Connection refused (ECONNREFUSED)
- Connection closed errors (ENOTOPEN, connection is closed)
- Database status messages (is being brought online, is starting up, is resuming)

**Implemented Automatic Retry with Exponential Backoff:**
```javascript
async function queryWithRetry(queryText, params, maxRetries = 3, retryDelay = 5000) {
  // Retries up to 3 times
  // Base delay: 5 seconds
  // Exponential backoff: 5s, 10s, 20s
  // Total max retry time: ~35 seconds
}
```

### 2. API Response Enhancement (`api/auth-status/index.js`)

When database warmup is detected:
- Returns HTTP 503 (Service Unavailable) instead of 500
- Includes `databaseWarming: true` flag in response
- Provides clear error message: "Database is warming up. Please wait a moment..."

### 3. Frontend User Experience

**Main Page (`app/page.tsx`):**
Shows dedicated warmup screen with:
- ⏳ Hourglass emoji icon
- Title: "Database is Loading"
- Explanation: "The database is warming up. This typically takes 30-60 seconds when the site hasn't been accessed recently."
- Loading spinner animation
- Message: "Please wait, you'll be automatically redirected when ready..."
- Automatic retry every 3 seconds

**Access Request Component (`components/AccessRequest.tsx`):**
Also handles warmup state with similar clear messaging and automatic retry.

## User Experience Improvements

### Before Fix:
❌ Error shows: "Access Denied"
❌ User thinks they don't have permission
❌ No indication of what's happening
❌ No automatic retry
❌ Confusing and frustrating experience

### After Fix:
✅ Clear message: "Database is Loading"
✅ Explanation of typical warmup time (30-60 seconds)
✅ Visual indicator (hourglass emoji + loading spinner)
✅ Automatic retry every 3 seconds
✅ User knows to wait, no action needed
✅ Smooth transition when database is ready

## Retry Strategy

**Backend (Database Module):**
- Attempts: 3 retries
- Initial delay: 5 seconds
- Exponential backoff multiplier: 2.0
- Retry delays: 5s, 10s, 20s
- Total backend retry time: ~35 seconds

**Frontend:**
- Polls every 3 seconds indefinitely
- Continues until database responds successfully
- No manual intervention needed

**Combined Strategy:**
- Backend handles initial warmup with aggressive retries
- If database still warming after backend retries, returns 503
- Frontend continues polling until database is ready
- Total coverage: Backend (35s) + Frontend (unlimited polling) = Complete warmup handling

## Testing

Added comprehensive test suite (`tests/database-warmup.spec.ts`):
- Tests warmup error detection in API responses
- Tests UI display of warmup messages
- Tests automatic retry mechanism
- Tests that "Access Denied" is NOT shown for warmup errors
- Tests API endpoints handle warmup gracefully
- Tests user feedback is clear and helpful

## Configuration

No configuration changes needed. The fix works automatically for:
- Azure SQL Database Serverless tier (auto-pause/auto-resume)
- Connection timeout scenarios
- Database startup delays
- Network connectivity issues during connection

## Deployment Notes

1. **No Breaking Changes:** Existing functionality is preserved
2. **Backwards Compatible:** Works with existing database configurations
3. **No New Dependencies:** Uses only existing npm packages
4. **Performance Impact:** Minimal - only adds retry logic for error cases
5. **User Impact:** Positive - better experience during database warmup

## Monitoring Recommendations

To monitor database warmup occurrences:
1. Check application logs for "Database is warming up" messages
2. Monitor HTTP 503 responses from /api/auth-status
3. Consider adjusting Azure SQL auto-pause delay if warmups are frequent
4. Typical auto-pause delay: 1 hour (can be increased to reduce warmups)

## Cost Considerations

**Azure SQL Serverless:**
- Auto-pause saves costs during inactive periods
- Warmup delay is trade-off for cost savings
- Typical serverless cost: $5-15/month for small family use
- Always-on would cost more but eliminate warmup delays

**Recommendation for Production:**
- Keep serverless auto-pause for cost savings
- This fix makes the warmup delay transparent to users
- Monitor usage patterns - if site is accessed frequently, consider:
  - Increasing auto-pause delay (e.g., from 1 hour to 6 hours)
  - Or using provisioned tier for always-on performance

## Related Files Modified

- `api/shared/db.js` - Database connection and retry logic
- `api/auth-status/index.js` - API endpoint error handling
- `app/page.tsx` - Main page UI for warmup state
- `components/AccessRequest.tsx` - Access request component warmup handling
- `tests/database-warmup.spec.ts` - Comprehensive test suite

## Security Considerations

- No security vulnerabilities introduced (verified with CodeQL)
- No sensitive information exposed in error messages
- Retry mechanism has reasonable limits to prevent DoS
- HTTP 503 status code correctly indicates temporary unavailability
