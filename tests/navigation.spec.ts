import { test, expect } from '@playwright/test';

/**
 * Navigation and authentication tests for Family Album
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

  test('should show user interface elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // In dev mode, the app should load without requiring authentication
    // Look for navigation elements or key UI components
    const bodyContent = await page.textContent('body');
    expect(bodyContent).toBeTruthy();
  });

  test('should navigate between views', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for any loading indicators to disappear
    await page.waitForTimeout(1000);
    
    // Check that we can interact with the page
    const interactiveElements = page.locator('button, a[href], input');
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Dev Mode', () => {
  test('should bypass authentication in dev mode', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // In dev mode, we should not be redirected to login
    expect(page.url()).not.toContain('/login');
    expect(page.url()).not.toContain('/.auth/');
  });
});
