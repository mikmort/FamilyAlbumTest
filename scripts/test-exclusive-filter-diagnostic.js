#!/usr/bin/env node

/**
 * Diagnostic script to verify exclusiveFilter is working
 * Usage: node scripts/test-exclusive-filter-diagnostic.js
 */

const https = require('https');

// Get API host from environment or default
const API_HOST = process.env.API_HOST || 'familyalbumtest.azurewebsites.net';

async function testExclusiveFilter() {
  console.log('🔍 Testing exclusiveFilter behavior\n');
  
  // Test case: select people 1 and 2 with exclusiveFilter
  const peopleIds = '1,2';
  const path = `/api/media?peopleIds=${peopleIds}&exclusiveFilter=true&sortOrder=desc`;
  
  console.log(`API Host: ${API_HOST}`);
  console.log(`Path: ${path}\n`);
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_HOST,
      path: path,
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          
          if (!result.data || !Array.isArray(result.data)) {
            console.error('❌ Invalid response format');
            reject(result);
            return;
          }

          console.log(`Found ${result.data.length} results\n`);

          if (result.data.length === 0) {
            console.log('⚠️  No results - checking if this is correct...');
            console.log('   (This is OK if there are no photos with EXACTLY people 1 and 2)\n');
            resolve(result);
            return;
          }

          // Analyze the results
          let correctCount = 0;
          let incorrectCount = 0;
          const issues = [];

          result.data.forEach((item, idx) => {
            if (!item.TaggedPeople) {
              issues.push(`[${idx}] ${item.PFileName}: No TaggedPeople data`);
              return;
            }

            const ids = item.TaggedPeople.map(p => p.ID).sort((a, b) => a - b);
            const hasAll = ids.includes(1) && ids.includes(2);
            const hasOnly = ids.length === 2;
            const nameCount = item.PNameCount;

            if (hasAll && hasOnly && nameCount === 2) {
              correctCount++;
              if (idx < 3) {
                console.log(`✅ [${idx}] ${item.PFileName}`);
                console.log(`   TaggedPeople: [${ids.join(', ')}]`);
                console.log(`   PNameCount: ${nameCount}\n`);
              }
            } else {
              incorrectCount++;
              if (idx < 5) {
                console.log(`❌ [${idx}] ${item.PFileName}`);
                console.log(`   TaggedPeople: [${ids.join(', ')}]`);
                console.log(`   PNameCount: ${nameCount}`);
                console.log(`   Expected: Exactly [1, 2] with PNameCount=2\n`);
              }
              issues.push(`Result ${idx}: has [${ids.join(', ')}] with PNameCount=${nameCount}`);
            }
          });

          console.log(`Summary:`);
          console.log(`  ✅ Correct (exactly 1,2): ${correctCount}`);
          console.log(`  ❌ Incorrect: ${incorrectCount}`);
          console.log(`  Total: ${result.data.length}\n`);

          if (incorrectCount > 0) {
            console.log('❌ ISSUE: exclusiveFilter is not working correctly!');
            console.log('   The API is returning photos that don\'t match the filter criteria');
          } else if (correctCount === result.data.length) {
            console.log('✅ GOOD: exclusiveFilter is working correctly!');
          }

          resolve(result);
        } catch (error) {
          console.error('❌ Error parsing response:', error.message);
          reject(error);
        }
      });
    }).on('error', reject);
  });
}

testExclusiveFilter().catch(err => {
  console.error('Test failed:', err.message || err);
  process.exit(1);
});
