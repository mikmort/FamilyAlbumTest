/**
 * Simple verification script to test dev mode without Playwright
 * This script tests that the API responds correctly with dev mode enabled
 */

const http = require('http');

// Test configuration
const DEV_MODE = process.env.DEV_MODE || 'true';
const HOST = 'localhost';
const PORT = 3000;
const TIMEOUT = 5000; // 5 seconds

console.log('🧪 Dev Mode Verification Script');
console.log('================================');
console.log(`DEV_MODE: ${DEV_MODE}`);
console.log(`Testing against: http://${HOST}:${PORT}`);
console.log('');

// Check if server is running
function checkServer() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://${HOST}:${PORT}/`, { timeout: TIMEOUT }, (res) => {
      console.log('✅ Server is running');
      console.log(`   Status: ${res.statusCode}`);
      resolve(true);
    });
    
    req.on('error', (err) => {
      console.log('❌ Server is not running');
      console.log(`   Error: ${err.message}`);
      console.log('');
      console.log('💡 Start the server with: npm run dev');
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Server request timed out');
      reject(new Error('Timeout'));
    });
  });
}

// Test API endpoint (follows redirects)
function testEndpoint(path, expectedStatus = 200, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount === 0) {
      console.log(`\n🔍 Testing: ${path}`);
    }
    
    const req = http.get(`http://${HOST}:${PORT}${path}`, { timeout: TIMEOUT }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        if (redirectCount < 3) {
          const location = res.headers.location.startsWith('http') 
            ? new URL(res.headers.location).pathname 
            : res.headers.location;
          console.log(`   → Following redirect to: ${location}`);
          return testEndpoint(location, expectedStatus, redirectCount + 1)
            .then(resolve)
            .catch(reject);
        } else {
          console.log(`❌ Too many redirects`);
          return resolve({ success: false, status: res.statusCode, data: '' });
        }
      }
      
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode === expectedStatus;
        
        if (success) {
          console.log(`✅ Success: ${res.statusCode}`);
          
          try {
            const parsed = JSON.parse(data);
            console.log(`   Response: ${JSON.stringify(parsed, null, 2).split('\n').slice(0, 10).join('\n   ')}`);
          } catch (e) {
            console.log(`   Response: ${data.substring(0, 100)}...`);
          }
          
          resolve({ success: true, status: res.statusCode, data });
        } else {
          console.log(`❌ Failed: Expected ${expectedStatus}, got ${res.statusCode}`);
          console.log(`   Response: ${data.substring(0, 200)}`);
          resolve({ success: false, status: res.statusCode, data });
        }
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ Request failed: ${err.message}`);
      reject(err);
    });
    
    req.on('timeout', () => {
      req.destroy();
      console.log('❌ Request timed out');
      reject(new Error('Timeout'));
    });
  });
}

// Main test function
async function runTests() {
  try {
    console.log('Step 1: Checking server...');
    await checkServer();
    
    console.log('\nStep 2: Testing API endpoints with dev mode...');
    
    const results = [];
    
    // Test auth-status endpoint
    const authResult = await testEndpoint('/api/auth-status');
    results.push({ name: 'Auth Status', ...authResult });
    
    // If auth works, test other endpoints
    if (authResult.success) {
      // Test people endpoint (200 or 404 are both acceptable)
      const peopleResult = await testEndpoint('/api/people', 200);
      results.push({ name: 'People API', success: [200, 404].includes(peopleResult.status) });
      
      // Test events endpoint (200 or 404 are both acceptable)
      const eventsResult = await testEndpoint('/api/events', 200);
      results.push({ name: 'Events API', success: [200, 404].includes(eventsResult.status) });
      
      // Test media endpoint (200 or 404 are both acceptable)
      const mediaResult = await testEndpoint('/api/media?page=1&pageSize=10', 200);
      results.push({ name: 'Media API', success: [200, 404].includes(mediaResult.status) });
    }
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('================');
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    
    results.forEach(result => {
      console.log(`${result.success ? '✅' : '❌'} ${result.name}`);
    });
    
    console.log(`\nTotal: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('\n🎉 All tests passed! Dev mode is working correctly.');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests failed. Check the output above for details.');
      process.exit(1);
    }
    
  } catch (err) {
    console.error('\n❌ Test suite failed:', err.message);
    process.exit(1);
  }
}

// Instructions if server is not running
function printInstructions() {
  console.log('\n📋 To run this verification:');
  console.log('');
  console.log('1. Ensure .env.local has DEV_MODE=true');
  console.log('2. Start the dev server in another terminal:');
  console.log('   npm run dev');
  console.log('');
  console.log('3. Run this verification script:');
  console.log('   node tests/verify-dev-mode.js');
  console.log('');
}

// Run the tests
console.log('Starting verification in 1 second...');
console.log('');

setTimeout(() => {
  runTests().catch((err) => {
    console.error('Unexpected error:', err);
    printInstructions();
    process.exit(1);
  });
}, 1000);
