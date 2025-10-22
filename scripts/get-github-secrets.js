#!/usr/bin/env node

/**
 * Retrieve Azure SQL credentials from GitHub Secrets
 * 
 * Prerequisites:
 * - GitHub Personal Access Token (classic) with 'repo' scope
 * - Repository: mikmort/FamilyAlbumTest
 * 
 * Usage: node scripts/get-github-secrets.js <token>
 */

const https = require('https');

const token = process.argv[2];
const owner = 'mikmort';
const repo = 'FamilyAlbumTest';

if (!token) {
  console.error('ERROR: GitHub Personal Access Token required');
  console.error('');
  console.error('Usage: node scripts/get-github-secrets.js <YOUR_GITHUB_TOKEN>');
  console.error('');
  console.error('To create a token:');
  console.error('1. Go to https://github.com/settings/tokens');
  console.error('2. Click "Generate new token (classic)"');
  console.error('3. Select scope: repo');
  console.error('4. Copy the token and use it here');
  console.error('');
  console.error('Note: This script cannot directly read secrets (they\'re encrypted)');
  console.error('Instead, list available repository variables/secrets');
  process.exit(1);
}

console.log('Attempting to retrieve GitHub repository secrets...\n');

function makeRequest(method, path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path: path,
      method: method,
      headers: {
        'Authorization': `token ${token}`,
        'User-Agent': 'Node.js Script',
        'Accept': 'application/vnd.github+json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            resolve(JSON.parse(data));
          } else if (res.statusCode === 404) {
            reject(new Error(`Not found: ${path}`));
          } else if (res.statusCode === 401) {
            reject(new Error('Unauthorized - invalid token'));
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

(async () => {
  try {
    console.log('1. Checking repository settings...\n');
    
    // Get repository info
    const repo_info = await makeRequest('GET', `/repos/${owner}/${repo}`);
    console.log(`✓ Repository: ${repo_info.full_name}`);
    console.log(`  Owner: ${repo_info.owner.login}`);
    console.log(`  URL: ${repo_info.html_url}\n`);

    // List repository variables (not secrets, but check if available)
    console.log('2. Checking for repository variables...\n');
    try {
      const vars = await makeRequest('GET', `/repos/${owner}/${repo}/actions/variables`);
      if (vars.variables && vars.variables.length > 0) {
        console.log('Repository Variables:');
        vars.variables.forEach(v => {
          console.log(`  - ${v.name}: ${v.value}`);
        });
      }
    } catch (e) {
      console.log('(No repository variables found or not accessible)\n');
    }

    console.log('\n⚠️  IMPORTANT: GitHub Secrets are encrypted and cannot be read via API');
    console.log('(This is by design for security)\n');

    console.log('To get your Azure SQL credentials, use one of these methods:\n');
    console.log('METHOD 1: Check Azure Portal (Recommended)');
    console.log('  1. Go to https://portal.azure.com');
    console.log('  2. Find your SQL Database (FamilyAlbum)');
    console.log('  3. Click "Connection strings"');
    console.log('  4. Copy the server name (format: server-name.database.windows.net)');
    console.log('  5. Your admin username was set during creation');
    console.log('  6. If you forgot the password, use "Reset password" in the portal\n');

    console.log('METHOD 2: Check GitHub Actions Logs');
    console.log('  1. Go to: https://github.com/mikmort/FamilyAlbumTest/actions');
    console.log('  2. Click on a recent successful deployment');
    console.log('  3. Expand "Deploy to Azure Static Web Apps"');
    console.log('  4. Look for environment variable logs (may show connection info)\n');

    console.log('METHOD 3: Check Local Files');
    console.log('  Check if you have a .env.local or similar file with these vars:');
    console.log('  - AZURE_SQL_SERVER');
    console.log('  - AZURE_SQL_USER');
    console.log('  - AZURE_SQL_PASSWORD\n');

    process.exit(0);

  } catch (error) {
    console.error(`✗ Error: ${error.message}`);
    
    if (error.message.includes('Unauthorized')) {
      console.error('\nThe token provided is invalid or expired.');
      console.error('Create a new one at: https://github.com/settings/tokens');
    }
    
    process.exit(1);
  }
})();
