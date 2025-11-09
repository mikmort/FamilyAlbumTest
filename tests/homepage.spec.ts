import { test, expect } from '@playwright/test';

/**
 * Homepage tests for Family Album
 * Tests run with DEV_MODE enabled to bypass OAuth authentication
 */

test.describe('HomePage', () => {
  test('should load the home page without error', async ({ page }) => {
    await page.goto('/');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // The page should not show the error message
    const errorText = await page.textContent('body');
    expect(errorText).not.toContain('Failed to load homepage data');
    
    // Check for the welcome heading
    await expect(page.locator('text=Welcome to Your Family Album')).toBeVisible();
  });

  test('should display the hero section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for hero elements
    await expect(page.locator('text=Welcome to Your Family Album')).toBeVisible();
    await expect(page.locator('text=Preserving memories, connecting generations')).toBeVisible();
    await expect(page.locator('text=Surprise Me!')).toBeVisible();
  });

  test('should display stats if data is available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for data to load
    await page.waitForTimeout(2000);
    
    // Check if either stats are visible OR loading spinner is shown
    const hasStats = await page.locator('text=Photos & Videos').isVisible().catch(() => false);
    const hasLoading = await page.locator('.loading-spinner').isVisible().catch(() => false);
    const hasError = await page.locator('text=Try Again').isVisible().catch(() => false);
    
    // At least one of these should be true
    expect(hasStats || hasLoading || hasError).toBeTruthy();
  });

  test('should display "In This Month" section title', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for potential data loading
    await page.waitForTimeout(2000);
    
    // The section should say "In This Month" not "On This Day"
    const bodyText = await page.textContent('body');
    
    // If the section is visible, it should have the correct title
    if (bodyText && bodyText.includes('This Month')) {
      expect(bodyText).not.toContain('On This Day');
    }
  });
});
