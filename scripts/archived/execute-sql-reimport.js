#!/usr/bin/env node

/**
 * Execute SQL Reimport Script
 * 
 * This script:
 * 1. Reads the SQL script file
 * 2. Connects to Azure SQL using connection details from environment
 * 3. Executes the reimport with IDENTITY_INSERT
 * 4. Reports results
 * 
 * Prerequisites:
 * - AZURE_SQL_SERVER, AZURE_SQL_USER, AZURE_SQL_PASSWORD env vars set
 * - CSV files in C:\Temp\
 * - Database backup created before running
 * 
 * Usage: node scripts/execute-sql-reimport.js
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// Get connection details from environment or use provided values
const config = {
  server: process.env.AZURE_SQL_SERVER,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD
    }
  },
  options: {
    database: 'FamilyAlbum',
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 300000  // 5 minutes
  }
};

// Validate configuration
if (!config.server || !config.authentication.options.userName || !config.authentication.options.password) {
  console.error('ERROR: Missing Azure SQL connection details');
  console.error('Set environment variables:');
  console.error('  AZURE_SQL_SERVER=yourserver.database.windows.net');
  console.error('  AZURE_SQL_USER=youruser');
  console.error('  AZURE_SQL_PASSWORD=yourpassword');
  process.exit(1);
}

const SQL_SCRIPT_PATH = path.join(__dirname, '..', 'database', 'reimport-with-identity-preservation-v2.sql');

console.log('\n=== SQL Reimport Execution ===');
console.log(`Server: ${config.server}`);
console.log(`Database: ${config.options.database}`);
console.log(`Script: ${SQL_SCRIPT_PATH}`);

// Read SQL script
let sqlScript;
try {
  sqlScript = fs.readFileSync(SQL_SCRIPT_PATH, 'utf8');
  console.log('✓ SQL script loaded');
} catch (err) {
  console.error(`✗ Failed to read SQL script: ${err.message}`);
  process.exit(1);
}

// Connect and execute
(async () => {
  try {
    console.log('\nConnecting to Azure SQL...');
    await sql.connect(config);
    console.log('✓ Connected to Azure SQL');

    // Split script by GO statements and execute each batch
    const batches = sqlScript.split(/\nGO\n/i).filter(b => b.trim());
    
    console.log(`\n📋 Executing ${batches.length} batches...`);
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i].trim();
      if (!batch) continue;
      
      console.log(`\n[Batch ${i + 1}/${batches.length}]`);
      
      try {
        const request = new sql.Request();
        request.multiple = true;
        
        // Set timeout for this request
        request.timeout = 300000;  // 5 minutes
        
        const result = await request.query(batch);
        
        console.log('✓ Batch executed');
        
        // Log result set summaries
        if (result.recordsets && result.recordsets.length > 0) {
          result.recordsets.forEach((rs, idx) => {
            if (rs.length > 0) {
              console.log(`  Result set ${idx + 1}: ${rs.length} row(s)`);
              rs.forEach((row, rowIdx) => {
                if (rowIdx < 3) {  // Show first 3 rows
                  console.log(`    ${JSON.stringify(row)}`);
                }
              });
              if (rs.length > 3) {
                console.log(`    ... and ${rs.length - 3} more rows`);
              }
            }
          });
        }
        
      } catch (err) {
        console.error(`✗ Batch ${i + 1} failed: ${err.message}`);
        if (err.number) {
          console.error(`  SQL Error ${err.number}: ${err.originalError?.message}`);
        }
        throw err;
      }
    }

    console.log('\n\n✓ REIMPORT COMPLETE');
    console.log('\nNext steps:');
    console.log('1. Verify data with test queries');
    console.log('2. Test in deployed application at https://lively-glacier-02a77180f.2.azurestaticapps.net/');
    console.log('3. Check DSC04780 displays correct people in correct order');

  } catch (err) {
    console.error('\n✗ REIMPORT FAILED:', err.message);
    console.error('\nRollback option:');
    console.error('Restore from backup in Azure Portal');
    process.exit(1);
  } finally {
    await sql.close();
    console.log('\n✓ Database connection closed');
  }
})();
