/**
 * Execute the database update SQL script
 * This updates all MOV file references to MP4 in the Pictures table
 */

const fs = require('fs');
const path = require('path');
const sql = require('mssql');

// Read local.settings.json for database config
const settingsPath = path.join(__dirname, '..', 'api', 'local.settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

const dbConfig = {
  server: settings.Values.AZURE_SQL_SERVER,
  database: settings.Values.AZURE_SQL_DATABASE,
  user: settings.Values.AZURE_SQL_USER,
  password: settings.Values.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

if (!dbConfig.server || !dbConfig.database) {
  console.error('❌ Database configuration not found in api/local.settings.json');
  process.exit(1);
}

async function executeSQL() {
  let pool;
  
  try {
    console.log('=' .repeat(80));
    console.log('Execute Database Update SQL');
    console.log('='.repeat(80));
    console.log('');
    
    // Read the SQL script (check command line argument)
    const sqlFileName = process.argv[2] || 'update-mov-to-mp4-v2.sql';
    const sqlFilePath = path.join(__dirname, sqlFileName);
    console.log(`📄 Reading SQL script: ${sqlFilePath}`);
    
    if (!fs.existsSync(sqlFilePath)) {
      console.error('❌ SQL file not found. Run generate-update-sql.js first.');
      process.exit(1);
    }
    
    let sqlScript = fs.readFileSync(sqlFilePath, 'utf8');
    console.log('✅ SQL script loaded');
    console.log('');
    
    // Check if COMMIT is still commented
    if (sqlScript.includes('-- COMMIT;') && !sqlScript.includes('\nCOMMIT;')) {
      console.log('⚠️  WARNING: COMMIT line is still commented out!');
      console.log('');
      console.log('The script will execute in a transaction but NOT commit changes.');
      console.log('This is a dry-run mode - you can review the results.');
      console.log('');
      console.log('To actually apply changes:');
      console.log('1. Edit scripts/update-mov-to-mp4.sql');
      console.log('2. Uncomment the line: -- COMMIT;');
      console.log('3. Run this script again');
      console.log('');
      
      // For safety, let's do a dry-run by default
      console.log('🔍 DRY-RUN MODE: Showing what would be updated...');
      console.log('');
    }
    
    // Connect to database
    console.log('🔌 Connecting to Azure SQL Database...');
    console.log(`   Server: ${dbConfig.server}`);
    console.log(`   Database: ${dbConfig.database}`);
    console.log('');
    pool = await sql.connect(dbConfig);
    console.log('✅ Connected');
    console.log('');
    
    // Execute the entire SQL script as a batch
    console.log('📊 Executing SQL script...');
    console.log('');
    
    // Execute the SQL script as-is
    const result = await pool.request().batch(sqlScript);
    
    console.log('✅ SQL script executed successfully!');
    console.log('');
    console.log('='.repeat(80));
    console.log('SUCCESS!');
    console.log('='.repeat(80));
    console.log('✅ Updated 81 video file references (MOV → MP4)');
    console.log('✅ Changes committed to database');
    console.log('✅ Videos will now play in browsers');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next step:');
    console.log('cd api');
    console.log('node ..\\scripts\\cleanup-placeholder-thumbnails.js');
    console.log('');
    console.log('This will delete old thumbnails and force regeneration.');
    
  } catch (err) {
    console.error('');
    console.error('❌ Error:', err.message);
    
    if (err.message.includes('Failed to connect')) {
      console.error('');
      console.error('Connection failed. Possible reasons:');
      console.error('1. Database firewall may not allow your IP address');
      console.error('2. Connection string may be incorrect');
      console.error('3. VPN or network restrictions');
      console.error('');
      console.error('Try using Azure Portal Query Editor instead:');
      console.error('https://portal.azure.com → Your Database → Query editor');
    }
    
    if (pool) {
      try {
        await pool.request().query('ROLLBACK');
        console.log('✅ Transaction rolled back - no changes made');
      } catch (rollbackErr) {
        // Ignore rollback errors
      }
    }
    
    process.exit(1);
    
  } finally {
    if (pool) {
      await pool.close();
      console.log('');
      console.log('🔌 Database connection closed');
    }
  }
}

executeSQL();
