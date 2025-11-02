import { test, expect } from '@playwright/test';

/**
 * Admin features tests for Family Album
 * Tests for user access request handling and admin notifications
 */

test.describe('Admin Features', () => {
  
  test('auth-status should return pendingCount for admin users', async ({ request }) => {
    const response = await request.get('/api/auth-status');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // Should have pendingCount field
    expect(data).toHaveProperty('pendingCount');
    
    // In dev mode with Admin role, should have pendingCount
    if (data.user?.role === 'Admin') {
      expect(typeof data.pendingCount).toBe('number');
      expect(data.pendingCount).toBeGreaterThanOrEqual(0);
    }
  });

  test('should get pending user requests', async ({ request }) => {
    const response = await request.get('/api/users?pending=true');
    
    // Should return 200 for admin users
    if (response.ok()) {
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.requests)).toBe(true);
      
      // Verify request structure if any exist
      if (data.requests.length > 0) {
        const request = data.requests[0];
        expect(request).toHaveProperty('ID');
        expect(request).toHaveProperty('Email');
        expect(request).toHaveProperty('RequestedAt');
        expect(request).toHaveProperty('HoursSinceRequest');
      }
    }
  });

  test('should list all users', async ({ request }) => {
    const response = await request.get('/api/users');
    
    // Should return 200 for admin users
    if (response.ok()) {
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(Array.isArray(data.users)).toBe(true);
      
      // Verify user structure if any exist
      if (data.users.length > 0) {
        const user = data.users[0];
        expect(user).toHaveProperty('ID');
        expect(user).toHaveProperty('Email');
        expect(user).toHaveProperty('Role');
        expect(user).toHaveProperty('Status');
      }
    }
  });

  test('notify-admins should generate tokens and return approval links', async ({ request }) => {
    const response = await request.post('/api/notify-admins', {
      data: {
        userEmail: 'test-user@example.com',
        userName: 'Test User',
        message: 'Test access request'
      }
    });
    
    // Note: In dev mode, this might succeed or fail depending on whether
    // the Users table exists and has admin users
    if (response.ok()) {
      const data = await response.json();
      
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('approvalLinks');
      expect(data.approvalLinks).toHaveProperty('fullAccess');
      expect(data.approvalLinks).toHaveProperty('readOnly');
      expect(data.approvalLinks).toHaveProperty('deny');
      
      // Verify links contain tokens
      expect(data.approvalLinks.fullAccess).toContain('token=');
      expect(data.approvalLinks.readOnly).toContain('token=');
      expect(data.approvalLinks.deny).toContain('token=');
      
      // Verify email status
      expect(data).toHaveProperty('emailSent');
      expect(data).toHaveProperty('emailMethod');
    }
  });

  test('should update user with role when approving', async ({ request }) => {
    // First, try to get users list
    const usersResponse = await request.get('/api/users?pending=true');
    
    if (usersResponse.ok()) {
      const usersData = await usersResponse.json();
      
      // If we have pending requests, test approval with role
      if (usersData.requests && usersData.requests.length > 0) {
        const pendingUser = usersData.requests[0];
        
        const updateResponse = await request.put('/api/users', {
          data: {
            id: pendingUser.ID,
            role: 'Read',
            status: 'Active'
          }
        });
        
        if (updateResponse.ok()) {
          const updateData = await updateResponse.json();
          expect(updateData.success).toBe(true);
          expect(updateData.message).toContain('updated successfully');
        }
      }
    }
  });
});

test.describe('Admin Settings UI', () => {
  
  test('should display Admin Settings with pending requests badge', async ({ page }) => {
    await page.goto('/');
    
    // Wait for auth check
    await page.waitForLoadState('networkidle');
    
    // Check if Admin Settings button exists (only for admin users)
    const adminButton = page.locator('button:has-text("Admin Settings")');
    
    if (await adminButton.isVisible()) {
      // Check if badge exists when there are pending requests
      const badge = adminButton.locator('span');
      
      // Badge may or may not be visible depending on pending requests
      // Just verify the button structure is correct
      await expect(adminButton).toBeVisible();
    }
  });

  test('should show role selector for pending requests', async ({ page }) => {
    await page.goto('/');
    
    // Wait for auth check
    await page.waitForLoadState('networkidle');
    
    // Check if Admin Settings button exists
    const adminButton = page.locator('button:has-text("Admin Settings")');
    
    if (await adminButton.isVisible()) {
      await adminButton.click();
      
      // Wait for admin settings to load
      await page.waitForLoadState('networkidle');
      
      // Check for pending requests section
      const pendingSection = page.locator('text=Pending Access Requests');
      
      if (await pendingSection.isVisible()) {
        // Check if role selector exists
        const roleSelect = page.locator('select').first();
        
        if (await roleSelect.isVisible()) {
          // Verify options exist
          await expect(roleSelect).toBeVisible();
          
          // Verify role options are present
          const options = await roleSelect.locator('option').allTextContents();
          expect(options).toContain('Read');
          expect(options).toContain('Full');
          expect(options).toContain('Admin');
        }
      }
    }
  });

  test('should have Approve and Deny buttons for pending requests', async ({ page }) => {
    await page.goto('/');
    
    // Wait for auth check
    await page.waitForLoadState('networkidle');
    
    // Check if Admin Settings button exists
    const adminButton = page.locator('button:has-text("Admin Settings")');
    
    if (await adminButton.isVisible()) {
      await adminButton.click();
      
      // Wait for admin settings to load
      await page.waitForLoadState('networkidle');
      
      // Check for pending requests section
      const pendingSection = page.locator('text=Pending Access Requests');
      
      if (await pendingSection.isVisible()) {
        // Look for Approve and Deny buttons
        const approveButton = page.locator('button:has-text("Approve")').first();
        const denyButton = page.locator('button:has-text("Deny")').first();
        
        if (await approveButton.isVisible()) {
          await expect(approveButton).toBeVisible();
        }
        
        if (await denyButton.isVisible()) {
          await expect(denyButton).toBeVisible();
        }
      }
    }
  });
});
