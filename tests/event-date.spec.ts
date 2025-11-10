import { test, expect } from '@playwright/test';

test.describe('Event Date Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to events page
    await page.goto('http://localhost:3000');
    await page.click('text=Settings');
    await page.click('text=Manage Events');
    await page.waitForLoadState('networkidle');
  });

  test('should display event date field in create form', async ({ page }) => {
    // Click "Add New Event" button
    await page.click('button:has-text("Add New Event")');
    
    // Verify the form appears with Event Date field
    await expect(page.locator('label:has-text("Event Date")')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
  });

  test('should create event with date and display it in the table', async ({ page }) => {
    // Click "Add New Event" button
    await page.click('button:has-text("Add New Event")');
    
    // Fill in the form
    const testEventName = `Test Event ${Date.now()}`;
    await page.fill('input[placeholder*="Sarah"]', testEventName);
    await page.fill('input[type="date"]', '2024-12-25');
    await page.fill('textarea', 'Test event description');
    
    // Submit the form
    await page.click('button:has-text("Create")');
    
    // Wait for the event to appear in the table
    await page.waitForTimeout(1000);
    
    // Verify the event appears with the date badge
    await expect(page.locator(`text=${testEventName}`)).toBeVisible();
    await expect(page.locator('.event-date-badge:has-text("Dec 25, 2024")')).toBeVisible();
  });

  test('should edit event date', async ({ page }) => {
    // Find an event with a date and click edit
    const editButton = page.locator('button[title="Edit"]').first();
    await editButton.click();
    
    // Verify the edit form appears with Event Date field
    await expect(page.locator('label:has-text("Event Date")')).toBeVisible();
    
    // Change the date
    await page.fill('input[type="date"]', '2025-06-15');
    
    // Save changes
    await page.click('button:has-text("Save Changes")');
    
    // Wait for update
    await page.waitForTimeout(1000);
    
    // Verify the updated date appears
    await expect(page.locator('.event-date-badge:has-text("Jun 15, 2025")')).toBeVisible();
  });

  test('should show dash for events without dates', async ({ page }) => {
    // Look for events in the table
    const rows = page.locator('tbody tr');
    const count = await rows.count();
    
    if (count > 0) {
      // Check if any row without a date badge shows "—"
      const detailsCells = page.locator('td.relation-cell');
      const firstCell = detailsCells.first();
      const hasDateBadge = await firstCell.locator('.event-date-badge').count() > 0;
      
      if (!hasDateBadge) {
        await expect(firstCell).toContainText('—');
      }
    }
  });
});
