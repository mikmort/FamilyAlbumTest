#!/usr/bin/env node

/**
 * Check Python API Configuration
 * 
 * This script verifies that the Python API proxy is properly configured
 * and that both Node.js and Python APIs are set up correctly.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Checking Python API Configuration...\n');

let hasErrors = false;

// Check 1: Verify proxy endpoint exists
console.log('1️⃣ Checking proxy endpoint...');
const proxyPath = path.join(__dirname, '..', 'api', 'generate-embeddings');
if (fs.existsSync(proxyPath)) {
  console.log('   ✅ Proxy endpoint exists: api/generate-embeddings/');
  
  const indexPath = path.join(proxyPath, 'index.js');
  const functionPath = path.join(proxyPath, 'function.json');
  
  if (fs.existsSync(indexPath) && fs.existsSync(functionPath)) {
    console.log('   ✅ Proxy files complete (index.js + function.json)');
  } else {
    console.log('   ❌ Proxy files incomplete');
    hasErrors = true;
  }
} else {
  console.log('   ❌ Proxy endpoint missing: api/generate-embeddings/');
  hasErrors = true;
}

// Check 2: Verify local.settings.json has PYTHON_FUNCTION_APP_URL
console.log('\n2️⃣ Checking Node.js API configuration...');
const localSettingsPath = path.join(__dirname, '..', 'api', 'local.settings.json');
if (fs.existsSync(localSettingsPath)) {
  try {
    const settings = JSON.parse(fs.readFileSync(localSettingsPath, 'utf8'));
    const pythonUrl = settings.Values?.PYTHON_FUNCTION_APP_URL;
    
    if (pythonUrl) {
      console.log(`   ✅ PYTHON_FUNCTION_APP_URL is set: ${pythonUrl}`);
    } else {
      console.log('   ⚠️  PYTHON_FUNCTION_APP_URL not set in api/local.settings.json');
      console.log('   Add: "PYTHON_FUNCTION_APP_URL": "http://localhost:7072"');
      hasErrors = true;
    }
  } catch (err) {
    console.log(`   ❌ Error reading api/local.settings.json: ${err.message}`);
    hasErrors = true;
  }
} else {
  console.log('   ❌ api/local.settings.json not found');
  console.log('   Run: npm run setup:api-env');
  hasErrors = true;
}

// Check 3: Verify Python API directory exists
console.log('\n3️⃣ Checking Python API...');
const pythonApiPath = path.join(__dirname, '..', 'api-python', 'generate-embeddings');
if (fs.existsSync(pythonApiPath)) {
  console.log('   ✅ Python API exists: api-python/generate-embeddings/');
  
  const pythonInitPath = path.join(pythonApiPath, '__init__.py');
  const pythonFunctionPath = path.join(pythonApiPath, 'function.json');
  
  if (fs.existsSync(pythonInitPath) && fs.existsSync(pythonFunctionPath)) {
    console.log('   ✅ Python API files complete');
  } else {
    console.log('   ❌ Python API files incomplete');
    hasErrors = true;
  }
} else {
  console.log('   ❌ Python API missing: api-python/generate-embeddings/');
  hasErrors = true;
}

// Check 4: Try to ping both APIs
console.log('\n4️⃣ Checking if APIs are running...');

checkEndpoint('http://localhost:7071/api/version', 'Node.js API')
  .then(() => {
    return checkEndpoint('http://localhost:7072/api/version', 'Python API');
  })
  .then(() => {
    console.log('\n' + '='.repeat(60));
    if (hasErrors) {
      console.log('❌ Configuration issues found. Please fix the errors above.');
      console.log('\nQuick Fix:');
      console.log('1. Update api/local.settings.json with PYTHON_FUNCTION_APP_URL');
      console.log('2. Start Python API: cd api-python && func start');
      console.log('3. Start Node.js API: cd api && func start');
      process.exit(1);
    } else {
      console.log('✅ All checks passed!');
      console.log('\nBoth APIs are configured correctly.');
      console.log('If APIs are not running, start them:');
      console.log('  Terminal 1: cd api-python && func start');
      console.log('  Terminal 2: cd api && func start');
      console.log('  Terminal 3: npm run dev');
    }
  })
  .catch(() => {
    // Errors already logged
    process.exit(1);
  });

function checkEndpoint(url, name) {
  return new Promise((resolve) => {
    const parsedUrl = new URL(url);
    
    const req = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'GET',
      timeout: 2000
    }, (res) => {
      if (res.statusCode === 200 || res.statusCode === 404) {
        console.log(`   ✅ ${name} is running on ${parsedUrl.port}`);
        resolve();
      } else {
        console.log(`   ⚠️  ${name} responded with status ${res.statusCode}`);
        resolve();
      }
    });
    
    req.on('error', () => {
      console.log(`   ⚠️  ${name} is not running (${url})`);
      console.log(`      Start it: cd ${name === 'Node.js API' ? 'api' : 'api-python'} && func start`);
      resolve();
    });
    
    req.on('timeout', () => {
      console.log(`   ⚠️  ${name} timed out`);
      req.destroy();
      resolve();
    });
    
    req.end();
  });
}
