#!/usr/bin/env node

/**
 * Setup script for GitHub Coding Agent environment
 * This script configures the environment for local development and testing with:
 * - Dev mode enabled (authentication bypass)
 * - Azure Functions Core Tools check
 * - Environment variables from GitHub secrets (when available)
 * - Graceful degradation when resources aren't available
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const ENV_FILE = path.join(ROOT_DIR, '.env.local');
const API_SETTINGS_FILE = path.join(ROOT_DIR, 'api', 'local.settings.json');

console.log('🤖 GitHub Coding Agent Environment Setup');
console.log('=' .repeat(60));
console.log('');

// Step 1: Check Azure Functions Core Tools
console.log('Step 1: Checking Azure Functions Core Tools...');
try {
  const funcVersion = execSync('func --version', { encoding: 'utf-8' }).trim();
  console.log(`✅ Azure Functions Core Tools v${funcVersion} is installed`);
} catch (error) {
  console.log('⚠️  Azure Functions Core Tools not found');
  console.log('');
  console.log('To install:');
  console.log('  • Linux/Ubuntu: ./scripts/install-azure-functions.sh');
  console.log('  • macOS: brew tap azure/functions && brew install azure-functions-core-tools@4');
  console.log('  • Windows: npm install -g azure-functions-core-tools@4');
  console.log('');
  console.log('Or see: https://docs.microsoft.com/azure/azure-functions/functions-run-local');
  console.log('');
  console.log('⚠️  Continuing without Azure Functions (API will not be available)');
}
console.log('');

// Step 2: Check for GitHub secrets in environment
console.log('Step 2: Checking for Azure credentials...');
const hasAzureSQL = !!(process.env.AZURE_SQL_SERVER && process.env.AZURE_SQL_DATABASE);
const hasAzureStorage = !!(process.env.AZURE_STORAGE_ACCOUNT && process.env.AZURE_STORAGE_KEY);

if (hasAzureSQL) {
  console.log('✅ Azure SQL Database credentials found');
} else {
  console.log('⚠️  Azure SQL Database credentials not found');
}

if (hasAzureStorage) {
  console.log('✅ Azure Blob Storage credentials found');
} else {
  console.log('⚠️  Azure Blob Storage credentials not found');
}

if (!hasAzureSQL || !hasAzureStorage) {
  console.log('');
  console.log('💡 Note: Tests can run without Azure credentials (limited functionality)');
  console.log('   To add credentials: See docs/GITHUB_SECRETS_SETUP.md');
}
console.log('');

// Step 3: Create .env.local
console.log('Step 3: Creating .env.local...');
try {
  execSync('node scripts/setup-env.js', { 
    cwd: ROOT_DIR,
    stdio: 'pipe'
  });
  console.log('✅ Created .env.local');
} catch (error) {
  console.log('❌ Failed to create .env.local:', error.message);
  process.exit(1);
}
console.log('');

// Step 4: Create api/local.settings.json
console.log('Step 4: Creating api/local.settings.json...');
try {
  execSync('node scripts/setup-api-env.js', { 
    cwd: ROOT_DIR,
    stdio: 'pipe'
  });
  console.log('✅ Created api/local.settings.json');
} catch (error) {
  console.log('❌ Failed to create api/local.settings.json:', error.message);
  process.exit(1);
}
console.log('');

// Step 5: Summary
console.log('=' .repeat(60));
console.log('✅ Setup Complete!');
console.log('=' .repeat(60));
console.log('');

console.log('📋 Configuration Summary:');
console.log('  • Dev Mode: ✅ Enabled (authentication bypass)');
console.log(`  • Azure SQL: ${hasAzureSQL ? '✅ Configured' : '⚠️  Not configured'}`);
console.log(`  • Azure Storage: ${hasAzureStorage ? '✅ Configured' : '⚠️  Not configured'}`);

try {
  execSync('func --version', { stdio: 'pipe' });
  console.log('  • Azure Functions: ✅ Available');
} catch {
  console.log('  • Azure Functions: ⚠️  Not available');
}
console.log('');

console.log('🎯 Next Steps:');
console.log('');

// Check if func is available
let canRunFunctions = false;
try {
  execSync('func --version', { stdio: 'pipe' });
  canRunFunctions = true;
} catch {}

// Check if we have network restrictions
let hasNetworkRestrictions = false;
try {
  execSync('ping -c 1 -W 1 cdn.functions.azure.com', { stdio: 'pipe', timeout: 2000 });
} catch {
  hasNetworkRestrictions = true;
}

if (canRunFunctions && !hasNetworkRestrictions) {
  console.log('Option A: Full stack (API + Frontend)');
  console.log('  npm run dev:full');
  console.log('');
  console.log('Option B: Frontend only (no API)');
  console.log('  npm run dev');
  console.log('');
  console.log('Option C: Run tests');
  console.log('  npm test');
} else if (canRunFunctions && hasNetworkRestrictions) {
  console.log('⚠️  Azure Functions installed but network restricted');
  console.log('   (Cannot download extension bundles from cdn.functions.azure.com)');
  console.log('');
  console.log('Option A: Run frontend only');
  console.log('  npm run dev');
  console.log('');
  console.log('Option B: Run tests (without API)');
  console.log('  SKIP_API_SERVER=true npm test');
  console.log('');
  console.log('💡 Tip: Tests will skip API server startup in restricted environments');
} else {
  console.log('⚠️  Azure Functions not available. You can:');
  console.log('');
  console.log('Option A: Install Azure Functions Core Tools');
  console.log('  ./scripts/install-azure-functions.sh');
  console.log('  Then run: npm run dev:full');
  console.log('');
  console.log('Option B: Run frontend only (API calls will fail)');
  console.log('  npm run dev');
  console.log('');
  console.log('Option C: Run tests (some tests may fail without API)');
  console.log('  SKIP_API_SERVER=true npm test');
}

console.log('');
console.log('📚 Documentation:');
console.log('  • Dev Mode Guide: docs/DEV_MODE_TESTING.md');
console.log('  • GitHub Secrets: docs/GITHUB_SECRETS_SETUP.md');
console.log('  • Local Functions: docs/LOCAL_AZURE_FUNCTIONS.md (if exists)');
console.log('');
