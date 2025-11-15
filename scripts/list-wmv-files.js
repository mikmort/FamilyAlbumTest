/**
 * Quick script to list WMV files in the database
 */

const sql = require('mssql');

// Load settings from API local.settings.json
const localSettings = require('../api/local.settings.json');
const values = localSettings.Values;

const config = {
  server: values.AZURE_SQL_SERVER,
  database: values.AZURE_SQL_DATABASE,
  user: values.AZURE_SQL_USER,
  password: values.AZURE_SQL_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function main() {
  console.log('🔍 Checking for WMV files in database...\n');

  let pool;
  try {
    pool = await sql.connect(config);
    
    const result = await pool.request().query(`
      SELECT PFileName, PFileDirectory, PType, PYear, PMonth
      FROM Pictures 
      WHERE LOWER(PFileName) LIKE '%.wmv'
      ORDER BY PFileName
    `);

    const wmvFiles = result.recordset;
    
    if (wmvFiles.length === 0) {
      console.log('✓ No WMV files found in database.');
    } else {
      console.log(`Found ${wmvFiles.length} WMV file(s):\n`);
      wmvFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file.PFileName}`);
        if (file.PFileDirectory) {
          console.log(`   Directory: ${file.PFileDirectory}`);
        }
        if (file.PYear || file.PMonth) {
          console.log(`   Date: ${file.PMonth || '?'}/${file.PYear || '?'}`);
        }
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main().catch(console.error);
