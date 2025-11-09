import { test, expect } from '@playwright/test';

/**
 * Essential API endpoint tests for Family Album
 * Tests verify that core API endpoints respond correctly with dev mode enabled
 */

test.describe('Core API Endpoints', () => {
  test('should get auth status in dev mode', async ({ request }) => {
    const response = await request.get('/api/auth-status');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    // In dev mode, should be authenticated and authorized
    expect(data.authenticated).toBe(true);
    expect(data.authorized).toBe(true);
    expect(data.user).toBeTruthy();
    expect(data.user.email).toBeTruthy();
  });

  test('should list people', async ({ request }) => {
    const response = await request.get('/api/people');
    
    // Should return 200 or 404 if no people exist
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('should list events', async ({ request }) => {
    const response = await request.get('/api/events');
    
    // Should return 200 or 404 if no events exist
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  test('should list media with pagination', async ({ request }) => {
    const response = await request.get('/api/media?page=1&pageSize=10');
    
    // Should return 200 or 404 if no media exists
    expect([200, 404]).toContain(response.status());
    
    if (response.ok()) {
      const data = await response.json();
      expect(data).toHaveProperty('media');
      expect(Array.isArray(data.media)).toBe(true);
      expect(data).toHaveProperty('pagination');
    }
  });
});
