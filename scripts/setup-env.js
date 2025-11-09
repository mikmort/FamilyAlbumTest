#!/usr/bin/env node

/**
 * Setup script for creating .env.local from environment variables
 * This is particularly useful for GitHub Copilot and coding agents running in GitHub Actions
 * where secrets are available as environment variables.
 */

const fs = require('fs');
const path = require('path');

const ENV_FILE = path.join(__dirname, '..', '.env.local');
const TEMPLATE_FILE = path.join(__dirname, '..', '.env.local.template');

// Environment variables to check for
const ENV_VARS = {
  // Dev mode (always enabled for testing)
  DEV_MODE: process.env.DEV_MODE || 'true',
  DEV_USER_EMAIL: process.env.DEV_USER_EMAIL || 'dev@example.com',
  DEV_USER_ROLE: process.env.DEV_USER_ROLE || 'Admin',
  
  // Azure SQL Database
  AZURE_SQL_SERVER: process.env.AZURE_SQL_SERVER,
  AZURE_SQL_DATABASE: process.env.AZURE_SQL_DATABASE,
  AZURE_SQL_USER: process.env.AZURE_SQL_USER,
  AZURE_SQL_PASSWORD: process.env.AZURE_SQL_PASSWORD,
  
  // Azure Blob Storage
  AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT,
  AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY,
  AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER,
  
  // Email (optional)
  AZURE_COMMUNICATION_CONNECTION_STRING: process.env.AZURE_COMMUNICATION_CONNECTION_STRING,
  EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SITE_URL: process.env.SITE_URL,
};

function main() {
  console.log('🔧 Setting up .env.local for testing...\n');

  // Check if .env.local already exists
  if (fs.existsSync(ENV_FILE)) {
    console.log('⚠️  .env.local already exists. Checking if update is needed...\n');
    
    // Read existing file
    const existing = fs.readFileSync(ENV_FILE, 'utf8');
    
    // Check if it has DEV_MODE=true
    if (existing.includes('DEV_MODE=true')) {
      console.log('✅ .env.local already configured with DEV_MODE=true');
      return;
    }
    
    console.log('📝 Updating existing .env.local with dev mode settings...\n');
  } else {
    console.log('📝 Creating new .env.local...\n');
  }

  // Build env file content
  let content = [];
  
  content.push('# =============================================================================');
  content.push('# AUTO-GENERATED .env.local FOR TESTING');
  content.push('# =============================================================================');
  content.push('# This file was automatically generated for testing purposes.');
  content.push('# It enables dev mode to bypass authentication during Playwright tests.');
  content.push('# ⚠️  DO NOT commit this file to version control!');
  content.push('# ⚠️  DO NOT use these settings in production!');
  content.push('#');
  content.push(`# Generated: ${new Date().toISOString()}`);
  content.push('');
  
  // Development mode (always enabled for testing)
  content.push('# =============================================================================');
  content.push('# DEVELOPMENT MODE - ENABLED FOR TESTING');
  content.push('# =============================================================================');
  content.push('DEV_MODE=true');
  content.push(`DEV_USER_EMAIL=${ENV_VARS.DEV_USER_EMAIL}`);
  content.push(`DEV_USER_ROLE=${ENV_VARS.DEV_USER_ROLE}`);
  content.push('');
  
  // Azure SQL Database
  content.push('# =============================================================================');
  content.push('# AZURE SQL DATABASE');
  content.push('# =============================================================================');
  
  if (ENV_VARS.AZURE_SQL_SERVER && ENV_VARS.AZURE_SQL_DATABASE) {
    content.push(`AZURE_SQL_SERVER=${ENV_VARS.AZURE_SQL_SERVER}`);
    content.push(`AZURE_SQL_DATABASE=${ENV_VARS.AZURE_SQL_DATABASE}`);
    content.push(`AZURE_SQL_USER=${ENV_VARS.AZURE_SQL_USER || 'not-set'}`);
    content.push(`AZURE_SQL_PASSWORD=${ENV_VARS.AZURE_SQL_PASSWORD || 'not-set'}`);
    console.log('✅ Azure SQL Database credentials configured');
  } else {
    content.push('# AZURE_SQL_SERVER=your-server.database.windows.net');
    content.push('# AZURE_SQL_DATABASE=your-database-name');
    content.push('# AZURE_SQL_USER=your-username');
    content.push('# AZURE_SQL_PASSWORD=your-password');
    console.log('⚠️  Azure SQL Database credentials not found in environment');
    console.log('   Tests requiring database access may fail or use mock data');
  }
  content.push('');
  
  // Azure Blob Storage
  content.push('# =============================================================================');
  content.push('# AZURE BLOB STORAGE');
  content.push('# =============================================================================');
  
  if (ENV_VARS.AZURE_STORAGE_ACCOUNT && ENV_VARS.AZURE_STORAGE_KEY) {
    content.push(`AZURE_STORAGE_ACCOUNT=${ENV_VARS.AZURE_STORAGE_ACCOUNT}`);
    content.push(`AZURE_STORAGE_KEY=${ENV_VARS.AZURE_STORAGE_KEY}`);
    content.push(`AZURE_STORAGE_CONTAINER=${ENV_VARS.AZURE_STORAGE_CONTAINER || 'family-album-media'}`);
    console.log('✅ Azure Blob Storage credentials configured');
  } else {
    content.push('# AZURE_STORAGE_ACCOUNT=yourstorageaccount');
    content.push('# AZURE_STORAGE_KEY=your-storage-access-key');
    content.push('# AZURE_STORAGE_CONTAINER=family-album-media');
    console.log('⚠️  Azure Blob Storage credentials not found in environment');
    console.log('   Tests requiring media storage may fail or use mock data');
  }
  content.push('');
  
  // Email (optional)
  if (ENV_VARS.AZURE_COMMUNICATION_CONNECTION_STRING || ENV_VARS.SENDGRID_API_KEY) {
    content.push('# =============================================================================');
    content.push('# EMAIL NOTIFICATION (OPTIONAL)');
    content.push('# =============================================================================');
    
    if (ENV_VARS.AZURE_COMMUNICATION_CONNECTION_STRING) {
      content.push(`AZURE_COMMUNICATION_CONNECTION_STRING=${ENV_VARS.AZURE_COMMUNICATION_CONNECTION_STRING}`);
    }
    
    if (ENV_VARS.SENDGRID_API_KEY) {
      content.push(`SENDGRID_API_KEY=${ENV_VARS.SENDGRID_API_KEY}`);
    }
    
    if (ENV_VARS.EMAIL_FROM_ADDRESS) {
      content.push(`EMAIL_FROM_ADDRESS=${ENV_VARS.EMAIL_FROM_ADDRESS}`);
    }
    
    if (ENV_VARS.SITE_URL) {
      content.push(`SITE_URL=${ENV_VARS.SITE_URL}`);
    }
    
    content.push('');
    console.log('✅ Email notification credentials configured');
  }
  
  // Write to file
  fs.writeFileSync(ENV_FILE, content.join('\n'), 'utf8');
  
  console.log('\n✅ .env.local created successfully!\n');
  console.log('📍 Location:', ENV_FILE);
  console.log('\n🎯 Next steps:');
  console.log('   1. Run tests: npm test');
  console.log('   2. Start dev server: npm run dev');
  console.log('   3. Verify dev mode: node tests/verify-dev-mode.js');
  console.log('\n💡 Note: Tests will use dev mode to bypass authentication');
  console.log('   Some tests may fail if Azure credentials are not configured');
  console.log('');
}

// Run the script
try {
  main();
} catch (error) {
  console.error('\n❌ Error creating .env.local:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
