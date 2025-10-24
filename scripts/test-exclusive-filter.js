#!/usr/bin/env node

/**
 * Test script to verify exclusiveFilter logic in API
 * Tests: when exclusiveFilter=true with 2 people selected, only photos with EXACTLY those 2 people should be returned
 */

const https = require('https');

// Configuration
const API_HOST = process.env.API_HOST || 'familyalbumtest.azurewebsites.net';
const API_PATH = '/api/media?peopleIds=1,2&exclusiveFilter=true&sortOrder=desc';

console.log('Testing exclusiveFilter logic...\n');
console.log(`Requesting: https://${API_HOST}${API_PATH}\n`);

const options = {
  hostname: API_HOST,
  path: API_PATH,
  method: 'GET',
  headers: {
    'Accept': 'application/json'
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      
      if (!result.data || !Array.isArray(result.data)) {
        console.error('❌ Unexpected response format:', result);
        process.exit(1);
      }

      console.log(`Found ${result.data.length} photos with people IDs 1,2 (exclusiveFilter=true)\n`);
      
      if (result.data.length === 0) {
        console.log('⚠️  No results returned. This could mean:');
        console.log('   1. No photos have exactly people 1 and 2 tagged');
        console.log('   2. The exclusiveFilter logic is working correctly');
        process.exit(0);
      }

      // Check first few results
      result.data.slice(0, 5).forEach((item, idx) => {
        console.log(`${idx + 1}. ${item.PFileName}`);
        if (item.TaggedPeople && Array.isArray(item.TaggedPeople)) {
          console.log(`   Tagged people: ${item.TaggedPeople.map(p => `${p.ID}:${p.neName}`).join(', ')}`);
          
          // Verify this has EXACTLY people 1 and 2
          const ids = item.TaggedPeople.map(p => p.ID).sort((a, b) => a - b);
          const hasAll = ids.includes(1) && ids.includes(2);
          const hasOnly = ids.length === 2;
          
          if (hasAll && hasOnly) {
            console.log('   ✅ Has exactly people 1 and 2');
          } else {
            console.log(`   ❌ WRONG! Has people: [${ids.join(', ')}]`);
          }
        }
        console.log('');
      });
    } catch (error) {
      console.error('❌ Error parsing response:', error.message);
      console.error('Response:', data);
      process.exit(1);
    }
  });
});

req.on('error', (e) => {
  console.error(`❌ Error: ${e.message}`);
  process.exit(1);
});

req.end();
