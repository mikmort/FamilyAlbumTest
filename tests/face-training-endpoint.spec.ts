import { test, expect } from '@playwright/test';

/**
 * Test for face training endpoint that's failing in admin settings
 */

test.describe('Face Training Endpoint', () => {
  
  test('should successfully call faces-tagged-photos endpoint', async ({ request }) => {
    // This is the endpoint that's failing according to the issue
    const response = await request.get('/api/faces-tagged-photos?smartSample=true');
    
    // Log response for debugging
    console.log('Response status:', response.status());
    console.log('Response headers:', await response.headers());
    
    if (!response.ok()) {
      const body = await response.text();
      console.log('Error response body:', body);
    }
    
    // Check if response is successful
    expect(response.ok()).toBeTruthy();
    
    if (response.ok()) {
      const data = await response.json();
      console.log('Response data structure:', Object.keys(data));
      
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(true);
      expect(data).toHaveProperty('photos');
      expect(Array.isArray(data.photos)).toBe(true);
    }
  });
  
  test('should handle database warmup error gracefully', async ({ request }) => {
    const response = await request.get('/api/faces-tagged-photos?smartSample=true');
    
    if (response.status() === 503) {
      const data = await response.json();
      
      // Should return warmup error structure
      expect(data).toHaveProperty('success');
      expect(data.success).toBe(false);
      expect(data).toHaveProperty('isWarmup');
      expect(data.isWarmup).toBe(true);
      expect(data.error).toContain('warming up');
    }
  });
  
  test('should handle no tagged photos gracefully', async ({ request }) => {
    const response = await request.get('/api/faces-tagged-photos?smartSample=true');
    
    if (response.ok()) {
      const data = await response.json();
      
      if (data.photos.length === 0) {
        expect(data.message).toBeDefined();
      }
    }
  });
});
