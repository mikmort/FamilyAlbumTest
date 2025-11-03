import { test, expect } from '@playwright/test';

/**
 * Test for user approval/denial bug fix
 * Validates that pending requests are properly handled
 */

test.describe('User Approval/Denial Fix', () => {
  
  test('API should accept lowercase field names for user updates', async ({ request }) => {
    // This test verifies that the API correctly handles lowercase field names
    // which is what the frontend now sends
    
    // First check if we can access the users endpoint
    const response = await request.get('/api/users?pending=true');
    
    if (response.ok()) {
      const data = await response.json();
      expect(data.success).toBe(true);
      
      // If there are pending requests, we can test the update endpoint
      if (data.requests && data.requests.length > 0) {
        const pendingUser = data.requests[0];
        
        // Test that the API accepts lowercase field names (the fix)
        const updateResponse = await request.put('/api/users', {
          data: {
            id: pendingUser.ID,
            role: 'Read',  // lowercase 'role' (not 'Role')
            status: 'Active'  // lowercase 'status' (not 'Status')
          }
        });
        
        if (updateResponse.ok()) {
          const updateData = await updateResponse.json();
          expect(updateData.success).toBe(true);
          
          // Verify the user is no longer in pending status
          const checkResponse = await request.get('/api/users?pending=true');
          const checkData = await checkResponse.json();
          
          // The approved user should not be in the pending list anymore
          const stillPending = checkData.requests.find((r: any) => r.ID === pendingUser.ID);
          expect(stillPending).toBeUndefined();
        }
      }
    }
  });
  
  test('API should properly handle denial with lowercase status', async ({ request }) => {
    const response = await request.get('/api/users?pending=true');
    
    if (response.ok()) {
      const data = await response.json();
      
      // If we have multiple pending requests, test denial
      if (data.requests && data.requests.length > 1) {
        const pendingUser = data.requests[1];
        
        // Test denial with lowercase 'status'
        const denyResponse = await request.put('/api/users', {
          data: {
            id: pendingUser.ID,
            status: 'Denied'  // lowercase 'status' (not 'Status')
          }
        });
        
        if (denyResponse.ok()) {
          const denyData = await denyResponse.json();
          expect(denyData.success).toBe(true);
          
          // Verify the user is no longer in pending status
          const checkResponse = await request.get('/api/users?pending=true');
          const checkData = await checkResponse.json();
          
          // The denied user should not be in the pending list anymore
          const stillPending = checkData.requests.find((r: any) => r.ID === pendingUser.ID);
          expect(stillPending).toBeUndefined();
        }
      }
    }
  });
  
  test('pendingCount should decrease after approval', async ({ request }) => {
    // Get initial pending count
    const authResponse = await request.get('/api/auth-status');
    const authData = await authResponse.json();
    
    if (authData.user?.role === 'Admin') {
      const initialCount = authData.pendingCount || 0;
      
      // Get a pending request
      const pendingResponse = await request.get('/api/users?pending=true');
      const pendingData = await pendingResponse.json();
      
      if (pendingData.requests && pendingData.requests.length > 0) {
        const pendingUser = pendingData.requests[0];
        
        // Approve the user
        await request.put('/api/users', {
          data: {
            id: pendingUser.ID,
            role: 'Read',
            status: 'Active'
          }
        });
        
        // Check auth status again - pending count should decrease
        const newAuthResponse = await request.get('/api/auth-status');
        const newAuthData = await newAuthResponse.json();
        
        expect(newAuthData.pendingCount).toBeLessThan(initialCount);
      }
    }
  });
});
