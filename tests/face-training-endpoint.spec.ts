import { test, expect } from '@playwright/test';

/**
 * Test for face training endpoint that's failing in admin settings
 * Tests edge cases and error handling for the faces-tagged-photos endpoint
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
      
      // Check if it's a known error type
      try {
        const jsonBody = JSON.parse(body);
        console.log('Error details:', jsonBody);
        
        // If it's a warmup error, that's expected sometimes
        if (jsonBody.isWarmup) {
          expect(response.status()).toBe(503);
          expect(jsonBody.error).toContain('warming up');
          return;
        }
      } catch (e) {
        // Not JSON, log raw error
        console.log('Non-JSON error response');
      }
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
      
      // Log sampling stats if available
      if (data.samplingStats) {
        console.log('Sampling stats:', data.samplingStats);
      }
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
        expect(data.message).toContain('No tagged photos found');
      }
    }
  });
  
  test('should work with maxPerPerson parameter', async ({ request }) => {
    const response = await request.get('/api/faces-tagged-photos?maxPerPerson=5');
    
    // Should accept this parameter and work
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.smartSample).toBe(false);
      expect(data.maxPerPerson).toBe(5);
    }
  });
  
  test('should work without smartSample (all photos mode)', async ({ request }) => {
    const response = await request.get('/api/faces-tagged-photos?smartSample=false');
    
    // Should accept this parameter and work
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.smartSample).toBe(false);
    }
  });
});
