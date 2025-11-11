import { test, expect } from '@playwright/test';

/**
 * Basic navigation tests for Family Album
 * Tests run with DEV_MODE enabled to bypass OAuth authentication
 */

test.describe('Navigation', () => {
  test('should load the home page', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check that the main heading is present
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });

  test('should bypass authentication in dev mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // In dev mode, we should not be redirected to login
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/.auth/');
    
    // Should have some content visible
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });
});
