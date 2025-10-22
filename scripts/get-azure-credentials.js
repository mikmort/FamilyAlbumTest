#!/usr/bin/env node

/**
 * Interactive Azure SQL Credentials Helper
 * 
 * This guide helps you locate and enter your Azure SQL connection details
 * by walking through the Azure Portal process
 * 
 * Usage: node scripts/get-azure-credentials.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.clear();
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║     Azure SQL Credentials - Interactive Helper               ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  console.log('This tool will help you find and save your Azure SQL credentials.\n');

  console.log('Follow these steps in Azure Portal:\n');
  console.log('1. Go to https://portal.azure.com');
  console.log('2. Search for "SQL databases"');
  console.log('3. Click on "FamilyAlbum"');
  console.log('4. In the left sidebar, click "Connection strings"');
  console.log('5. Copy the connection string that starts with "Server=tcp:"\n');

  const connString = await question('Paste your connection string (or press ENTER to enter details manually): ');
  
  let server, user, password;

  if (connString.trim()) {
    // Parse connection string
    console.log('\nParsing connection string...\n');
    
    const serverMatch = connString.match(/Server=tcp:([^,;]+)/);
    const userMatch = connString.match(/User ID=([^;]+)/);
    
    if (serverMatch) {
      server = serverMatch[1];
      console.log(`✓ Server: ${server}`);
    } else {
      console.log('Could not parse server from connection string');
      server = null;
    }

    if (userMatch) {
      user = userMatch[1];
      console.log(`✓ User: ${user}`);
    } else {
      console.log('Could not parse user from connection string');
      user = null;
    }
  } else {
    console.log('\nEnter details manually:\n');
  }

  // Get server if not parsed
  if (!server) {
    server = await question('Azure SQL Server (e.g., myserver.database.windows.net): ');
  }

  // Get username if not parsed
  if (!user) {
    user = await question('SQL Username (e.g., sqladmin@myserver): ');
  }

  // Get password
  password = await question('SQL Password: ');

  console.log('\n');
  console.log('✓ Credentials entered:');
  console.log(`  Server: ${server}`);
  console.log(`  User: ${user}`);
  console.log(`  Password: ${'*'.repeat(password.length)}\n`);

  const saveChoice = await question('Save to .env.local file? (y/n): ');

  if (saveChoice.toLowerCase() === 'y') {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = `# Azure SQL Database Configuration
AZURE_SQL_SERVER=${server}
AZURE_SQL_DATABASE=FamilyAlbum
AZURE_SQL_USER=${user}
AZURE_SQL_PASSWORD=${password}
`;

    fs.writeFileSync(envPath, envContent);
    console.log(`\n✓ Saved to ${envPath}`);
    console.log('  This file should be kept secret and not committed to git\n');
  }

  console.log('Your credentials:');
  console.log(`\n  AZURE_SQL_SERVER=${server}`);
  console.log(`  AZURE_SQL_USER=${user}`);
  console.log(`  AZURE_SQL_PASSWORD=${password}\n`);

  console.log('Next steps:');
  console.log('1. Keep these credentials secure');
  console.log('2. Run the reimport script:');
  console.log('\n   $env:AZURE_SQL_SERVER="' + server + '"');
  console.log('   $env:AZURE_SQL_USER="' + user + '"');
  console.log('   $env:AZURE_SQL_PASSWORD="' + password + '"');
  console.log('   .\\scripts\\run-reimport.ps1\n');

  rl.close();
}

main().catch(console.error);
