import { test, expect } from '@playwright/test';

/**
 * Homepage tests for Family Album
 * Tests run with DEV_MODE enabled to bypass OAuth authentication
 * 
 * Note: These tests run without the API server, so they verify basic
 * frontend functionality only. Tests that require API responses have
 * been removed.
 */

test.describe('HomePage', () => {
  test('should load the home page without crashing', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // The page should render without JavaScript errors
    // Just check that we got some content
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });
});
