#!/usr/bin/env node

/**
 * Setup script for creating api/local.settings.json from environment variables
 * This enables Azure Functions to run locally with the same configuration as Next.js
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const API_DIR = path.join(__dirname, '..', 'api');
const SETTINGS_FILE = path.join(API_DIR, 'local.settings.json');
const SETTINGS_TEMPLATE = path.join(API_DIR, 'local.settings.json.template');
const ENV_FILE = path.join(__dirname, '..', '.env.local');

function main() {
  console.log('🔧 Setting up api/local.settings.json for Azure Functions...\n');

  // Load environment variables from .env.local if it exists
  if (fs.existsSync(ENV_FILE)) {
    console.log('📖 Loading environment from .env.local');
    dotenv.config({ path: ENV_FILE });
  } else {
    console.log('⚠️  .env.local not found, using environment variables only');
  }

  // Build settings object
  const settings = {
    IsEncrypted: false,
    Values: {
      FUNCTIONS_WORKER_RUNTIME: 'node',
      AzureWebJobsStorage: '',
      
      // Dev mode (for testing)
      DEV_MODE: process.env.DEV_MODE || 'true',
      DEV_USER_EMAIL: process.env.DEV_USER_EMAIL || 'dev@example.com',
      DEV_USER_ROLE: process.env.DEV_USER_ROLE || 'Admin',
      
      // Azure SQL Database
      AZURE_SQL_SERVER: process.env.AZURE_SQL_SERVER || '',
      AZURE_SQL_DATABASE: process.env.AZURE_SQL_DATABASE || '',
      AZURE_SQL_USER: process.env.AZURE_SQL_USER || '',
      AZURE_SQL_PASSWORD: process.env.AZURE_SQL_PASSWORD || '',
      
      // Azure Blob Storage
      AZURE_STORAGE_ACCOUNT: process.env.AZURE_STORAGE_ACCOUNT || '',
      AZURE_STORAGE_KEY: process.env.AZURE_STORAGE_KEY || '',
      AZURE_STORAGE_CONTAINER: process.env.AZURE_STORAGE_CONTAINER || 'family-album-media',
      
      // Email (optional)
      AZURE_COMMUNICATION_CONNECTION_STRING: process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '',
      EMAIL_FROM_ADDRESS: process.env.EMAIL_FROM_ADDRESS || '',
      SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || '',
      SITE_URL: process.env.SITE_URL || '',
    },
    Host: {
      LocalHttpPort: 7071,
      CORS: '*',
      CORSCredentials: false
    }
  };

  // Check if settings file already exists
  if (fs.existsSync(SETTINGS_FILE)) {
    console.log('⚠️  local.settings.json already exists. Checking if update is needed...\n');
    
    try {
      const existing = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      
      // Check if DEV_MODE is set
      if (existing.Values && existing.Values.DEV_MODE === 'true') {
        console.log('✅ local.settings.json already configured with DEV_MODE=true');
        
        // Check if credentials match
        const needsUpdate = 
          existing.Values.AZURE_SQL_SERVER !== settings.Values.AZURE_SQL_SERVER ||
          existing.Values.AZURE_STORAGE_ACCOUNT !== settings.Values.AZURE_STORAGE_ACCOUNT;
        
        if (!needsUpdate) {
          console.log('✅ Configuration is up to date');
          return;
        }
        
        console.log('📝 Updating configuration with new credentials...\n');
      }
    } catch (error) {
      console.log('⚠️  Error reading existing file, will overwrite:', error.message);
    }
  } else {
    console.log('📝 Creating new local.settings.json...\n');
  }

  // Write settings file
  fs.writeFileSync(
    SETTINGS_FILE,
    JSON.stringify(settings, null, 2),
    'utf8'
  );

  console.log('✅ local.settings.json created successfully!\n');
  console.log('📍 Location:', SETTINGS_FILE);
  
  // Report what was configured
  console.log('\n🔑 Configuration status:');
  
  if (settings.Values.AZURE_SQL_SERVER && settings.Values.AZURE_SQL_DATABASE) {
    console.log('   ✅ Azure SQL Database configured');
  } else {
    console.log('   ⚠️  Azure SQL Database not configured (API calls will fail)');
  }
  
  if (settings.Values.AZURE_STORAGE_ACCOUNT && settings.Values.AZURE_STORAGE_KEY) {
    console.log('   ✅ Azure Blob Storage configured');
  } else {
    console.log('   ⚠️  Azure Blob Storage not configured (media access will fail)');
  }
  
  if (settings.Values.DEV_MODE === 'true') {
    console.log('   ✅ Dev mode enabled (authentication bypass)');
  }

  console.log('\n🎯 Next steps:');
  console.log('   1. Start Azure Functions: npm run dev:api');
  console.log('   2. Start Next.js: npm run dev:frontend');
  console.log('   3. Or start both: npm run dev:full');
  console.log('   4. Run tests: npm test');
  console.log('\n💡 Note: Azure Functions will run on http://localhost:7071');
  console.log('   Next.js will proxy /api/* requests to the Functions API');
  console.log('');
}

// Run the script
try {
  main();
} catch (error) {
  console.error('\n❌ Error creating local.settings.json:', error.message);
  console.error('\nStack trace:', error.stack);
  process.exit(1);
}
