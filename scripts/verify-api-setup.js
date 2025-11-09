#!/usr/bin/env node

/**
 * Verification script to check if the local Azure Functions setup is ready
 * This doesn't actually start the servers, just checks configuration
 */

const fs = require('fs');
const path = require('path');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function checkFile(filePath, description) {
  if (fs.existsSync(filePath)) {
    console.log(`${GREEN}✓${RESET} ${description}: ${filePath}`);
    return true;
  } else {
    console.log(`${RED}✗${RESET} ${description}: ${filePath} NOT FOUND`);
    return false;
  }
}

function checkPackageJson() {
  const pkgPath = path.join(__dirname, '..', 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  
  console.log('\n📦 Package.json Scripts:');
  const requiredScripts = ['dev:api', 'dev:frontend', 'dev:full', 'setup:api-env'];
  let allPresent = true;
  
  requiredScripts.forEach(script => {
    if (pkg.scripts[script]) {
      console.log(`${GREEN}✓${RESET} ${script}: ${pkg.scripts[script]}`);
    } else {
      console.log(`${RED}✗${RESET} ${script}: NOT FOUND`);
      allPresent = false;
    }
  });
  
  return allPresent;
}

function checkPlaywrightConfig() {
  const configPath = path.join(__dirname, '..', 'playwright.config.ts');
  const config = fs.readFileSync(configPath, 'utf8');
  
  console.log('\n🎭 Playwright Configuration:');
  
  if (config.includes('webServer: [')) {
    console.log(`${GREEN}✓${RESET} Multiple webServer configuration found`);
    return true;
  } else if (config.includes('webServer: {')) {
    console.log(`${YELLOW}⚠${RESET} Single webServer configuration (legacy)`);
    console.log('   Consider using array format for both API and frontend');
    return false;
  } else {
    console.log(`${RED}✗${RESET} No webServer configuration found`);
    return false;
  }
}

function main() {
  console.log('🔍 Verifying Local Azure Functions Setup\n');
  
  let allGood = true;
  
  // Check key files
  console.log('📁 Key Files:');
  allGood &= checkFile(
    path.join(__dirname, '..', 'api', 'local.settings.json.template'),
    'API settings template'
  );
  allGood &= checkFile(
    path.join(__dirname, 'setup-api-env.js'),
    'API setup script'
  );
  allGood &= checkFile(
    path.join(__dirname, '..', 'docs', 'LOCAL_AZURE_FUNCTIONS.md'),
    'Documentation'
  );
  
  // Check generated files (optional)
  console.log('\n📝 Generated Files (optional):');
  const envExists = checkFile(
    path.join(__dirname, '..', '.env.local'),
    'Environment file'
  );
  const settingsExists = checkFile(
    path.join(__dirname, '..', 'api', 'local.settings.json'),
    'API settings file'
  );
  
  if (!envExists) {
    console.log(`   ${YELLOW}→${RESET} Run: npm run setup:env`);
  }
  if (!settingsExists) {
    console.log(`   ${YELLOW}→${RESET} Run: npm run setup:api-env`);
  }
  
  // Check package.json
  allGood &= checkPackageJson();
  
  // Check Playwright config
  allGood &= checkPlaywrightConfig();
  
  // Check for func command
  console.log('\n🔧 Azure Functions Core Tools:');
  const { execSync } = require('child_process');
  try {
    const version = execSync('func --version', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    console.log(`${GREEN}✓${RESET} Installed: ${version}`);
  } catch (error) {
    console.log(`${RED}✗${RESET} Not installed or not in PATH`);
    console.log(`   ${YELLOW}→${RESET} Install from: https://github.com/Azure/azure-functions-core-tools`);
    console.log(`   ${YELLOW}→${RESET} Or see: docs/LOCAL_AZURE_FUNCTIONS.md`);
    allGood = false;
  }
  
  // Final status
  console.log('\n' + '='.repeat(60));
  if (allGood) {
    console.log(`\n${GREEN}✅ Setup verification PASSED!${RESET}`);
    console.log('\n🚀 Next steps:');
    console.log('   1. npm run setup:env       (if not done)');
    console.log('   2. npm run setup:api-env   (if not done)');
    console.log('   3. npm run dev:full        (start both servers)');
    console.log('   4. npm test                (run tests)\n');
    process.exit(0);
  } else {
    console.log(`\n${RED}❌ Setup verification FAILED!${RESET}`);
    console.log('\n⚠️  Some components are missing or misconfigured.');
    console.log('   See docs/LOCAL_AZURE_FUNCTIONS.md for setup instructions.\n');
    process.exit(1);
  }
}

main();
