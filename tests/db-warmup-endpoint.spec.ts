import { test, expect } from '@playwright/test';

/**
 * Database Warmup Endpoint Tests
 * 
 * These tests verify that the /api/db-warmup endpoint works correctly
 * to wake up the database before user authentication.
 */

test.describe('Database Warmup Endpoint', () => {
  
  test('should respond to /api/db-warmup endpoint', async ({ request }) => {
    // Call the warmup endpoint
    const response = await request.get('/api/db-warmup');
    
    // Should return 200 OK even if database connection fails
    // (the endpoint returns success to indicate the warmup attempt was made)
    expect(response.status()).toBe(200);
    
    // Parse the response
    const data = await response.json();
    
    // Should have success flag
    expect(data.success).toBe(true);
    
    // Should indicate whether database is warmed or warming
    expect(data.warmed !== undefined || data.warming !== undefined).toBe(true);
  });

  test('should be accessible without authentication', async ({ request }) => {
    // The warmup endpoint should NOT require authentication
    // This allows it to be called immediately when the page loads
    
    const response = await request.get('/api/db-warmup');
    
    // Should NOT return 401 (Unauthorized) or 403 (Forbidden)
    expect(response.status()).not.toBe(401);
    expect(response.status()).not.toBe(403);
    
    // Should return 200 OK
    expect(response.status()).toBe(200);
  });

  test('should trigger database connection on page load', async ({ page }) => {
    // Spy on network requests
    const warmupRequests: string[] = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/db-warmup')) {
        warmupRequests.push(url);
      }
    });
    
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Verify that the warmup endpoint was called
    expect(warmupRequests.length).toBeGreaterThan(0);
  });

  test('should be called before auth-status endpoint', async ({ page }) => {
    // Track the order of API calls
    const apiCalls: { url: string; timestamp: number }[] = [];
    
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/db-warmup') || url.includes('/api/auth-status')) {
        apiCalls.push({
          url: url.includes('/api/db-warmup') ? 'db-warmup' : 'auth-status',
          timestamp: Date.now()
        });
      }
    });
    
    // Navigate to home page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Verify both endpoints were called
    const warmupCall = apiCalls.find(call => call.url === 'db-warmup');
    const authCall = apiCalls.find(call => call.url === 'auth-status');
    
    // Both should be called
    expect(warmupCall).toBeDefined();
    expect(authCall).toBeDefined();
    
    // Warmup should be called before auth-status
    if (warmupCall && authCall) {
      expect(warmupCall.timestamp).toBeLessThanOrEqual(authCall.timestamp);
    }
  });

  test('should not block page load if warmup fails', async ({ page }) => {
    // Navigate to home page
    await page.goto('/');
    
    // Page should load even if warmup endpoint has issues
    // Wait for page to be in a stable state
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    
    // Should show some content (not a blank page)
    const bodyText = await page.textContent('body').catch(() => '');
    expect(bodyText.length).toBeGreaterThan(0);
    
    // Should show either the app UI or loading/warmup message
    const hasContent = 
      bodyText.includes('Family Album') ||
      bodyText.includes('Select People') ||
      bodyText.includes('Database is Loading') ||
      bodyText.includes('Loading') ||
      bodyText.includes('Request Access');
    
    expect(hasContent).toBe(true);
  });
});
