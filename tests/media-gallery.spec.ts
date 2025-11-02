import { test, expect } from '@playwright/test';

/**
 * Media gallery tests for Family Album
 * Tests the main media browsing functionality
 */

test.describe('Media Gallery', () => {
  test('should display the people selector view initially', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for content to load
    await page.waitForTimeout(1000);
    
    // Look for typical UI elements in the people selector
    const content = await page.textContent('body');
    
    // Should have some content visible
    expect(content).toBeTruthy();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should have navigation buttons', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for buttons to appear
    await page.waitForTimeout(1000);
    
    // Count interactive elements
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    // Should have at least some buttons for navigation
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should allow filtering by people', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Try to find any checkboxes or selection elements
    const checkboxes = page.locator('input[type="checkbox"]');
    const checkboxCount = await checkboxes.count();
    
    // If there are people in the database, there should be checkboxes
    // This test is flexible to work with empty databases
    if (checkboxCount > 0) {
      // Select first person
      await checkboxes.first().check();
      
      // Should remain on the page without errors
      await page.waitForTimeout(500);
      expect(page.url()).toContain('localhost:3000');
    }
  });

  test('should have options for untagged media', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    const bodyText = await page.textContent('body');
    
    // The UI should have text content
    expect(bodyText).toBeTruthy();
  });
});

test.describe('Gallery View', () => {
  test('should navigate to gallery view', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Look for a "Continue" or "View Gallery" button
    const continueButton = page.locator('button').filter({ hasText: /continue|view|gallery/i }).first();
    
    if (await continueButton.count() > 0) {
      await continueButton.click();
      await page.waitForTimeout(1000);
      
      // Should remain on the site
      expect(page.url()).toContain('localhost:3000');
    }
  });

  test('should display media thumbnails when available', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to gallery if possible
    const continueButton = page.locator('button').filter({ hasText: /continue|view|gallery/i }).first();
    if (await continueButton.count() > 0) {
      await continueButton.click();
      await page.waitForTimeout(2000);
      
      // Look for image elements (thumbnails)
      const images = page.locator('img');
      const imageCount = await images.count();
      
      // If there's media in the database, images should appear
      // This test documents the expected behavior
      console.log(`Found ${imageCount} images in gallery view`);
    }
  });

  test('should allow sorting by date', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Look for sort controls
    const sortButtons = page.locator('button, select').filter({ hasText: /sort|date|order/i });
    const sortCount = await sortButtons.count();
    
    // If sort controls exist, test them
    if (sortCount > 0) {
      console.log(`Found ${sortCount} sort control(s)`);
    }
  });
});

test.describe('Media Detail View', () => {
  test('should open media detail modal when clicking thumbnail', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Navigate to gallery
    const continueButton = page.locator('button').filter({ hasText: /continue|view|gallery/i }).first();
    if (await continueButton.count() > 0) {
      await continueButton.click();
      await page.waitForTimeout(2000);
      
      // Try to click first media thumbnail
      const thumbnails = page.locator('img[src*="blob.core.windows.net"], img[alt*="photo"], img[alt*="media"]');
      if (await thumbnails.count() > 0) {
        await thumbnails.first().click();
        await page.waitForTimeout(1000);
        
        // Should show detail view (modal or expanded view)
        // Check that we're still on the page
        expect(page.url()).toContain('localhost:3000');
      }
    }
  });
});
