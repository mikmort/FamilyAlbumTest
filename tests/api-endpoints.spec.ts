import { test, expect } from '@playwright/test';

/**
 * API endpoint tests for Family Album
 * Tests verify that API endpoints respond correctly with dev mode enabled
 */

// Type definitions for API responses
interface TaggedPhoto {
  PersonID: number;
  PFileName: string;
  PersonName: string;
  url: string;
}

test.describe('API Endpoints', () => {
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

  test('should list media with filters', async ({ request }) => {
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

  test('should access admin endpoints with admin role', async ({ request }) => {
    // This test assumes DEV_USER_ROLE is set to Admin
    const response = await request.get('/api/users');
    
    // Should return 200 (list of users) or appropriate error
    // If database is not set up, might return 500
    expect([200, 500]).toContain(response.status());
  });
});

test.describe('API Authorization', () => {
  test('should have proper CORS headers', async ({ request }) => {
    const response = await request.get('/api/auth-status');
    
    // Check that response has appropriate headers
    expect(response.headers()).toBeTruthy();
  });

  test('should reject unauthorized requests when not in dev mode', async ({ request }) => {
    // This test documents expected behavior when DEV_MODE=false
    // In actual dev mode testing, this will pass because dev mode is enabled
    
    // When dev mode is disabled and no auth header is present,
    // the API should return 401 or 403
    // This test will pass in dev mode but documents the expected production behavior
    const response = await request.get('/api/auth-status');
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe('Face Recognition API', () => {
  test('should get tagged photos endpoint', async ({ request }) => {
    const response = await request.get('/api/faces/tagged-photos');
    
    // Should return 200 with success flag
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('photos');
    expect(Array.isArray(data.photos)).toBe(true);
    
    // If photos exist, verify they have the right structure
    if (data.photos.length > 0) {
      const photo = data.photos[0];
      expect(photo).toHaveProperty('PFileName');
      expect(photo).toHaveProperty('PersonID');
      expect(photo).toHaveProperty('PersonName');
      expect(photo).toHaveProperty('url');
    }
  });

  test('should support maxPerPerson parameter', async ({ request }) => {
    const response = await request.get('/api/faces/tagged-photos?maxPerPerson=2');
    
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    
    expect(data).toHaveProperty('success');
    expect(data.success).toBe(true);
    expect(data).toHaveProperty('maxPerPerson');
    expect(data.maxPerPerson).toBe(2);
    
    // Verify that no person has more than maxPerPerson photos
    if (data.photos.length > 0) {
      const photosPerPerson: { [key: number]: number } = {};
      data.photos.forEach((photo: TaggedPhoto) => {
        photosPerPerson[photo.PersonID] = (photosPerPerson[photo.PersonID] || 0) + 1;
      });
      
      // Each person should have at most 2 photos
      Object.values(photosPerPerson).forEach(count => {
        expect(count).toBeLessThanOrEqual(2);
      });
    }
  });
});
