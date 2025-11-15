/**
 * Verify the WMV to MP4 conversion in database
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
  console.log('🔍 Verifying conversion results...\n');

  let pool;
  try {
    pool = await sql.connect(config);
    
    // Check for remaining WMV files
    const wmvResult = await pool.request().query(`
      SELECT COUNT(*) as count
      FROM Pictures 
      WHERE LOWER(PFileName) LIKE '%.wmv'
    `);
    
    console.log(`WMV files remaining: ${wmvResult.recordset[0].count}`);
    
    // Check for the converted MP4 file
    const mp4Result = await pool.request().query(`
      SELECT PFileName, PFileDirectory, PType
      FROM Pictures 
      WHERE PFileName LIKE '%dentist.mp4'
    `);
    
    if (mp4Result.recordset.length > 0) {
      console.log('\n✓ MP4 file found in database:');
      mp4Result.recordset.forEach(file => {
        console.log(`  - ${file.PFileName}`);
        console.log(`    Directory: ${file.PFileDirectory}`);
      });
      
      // Check NamePhoto associations
      const namePhotoResult = await pool.request()
        .input('fileName', sql.NVarChar, mp4Result.recordset[0].PFileName)
        .query(`
          SELECT np.npID, ne.neName
          FROM NamePhoto np
          JOIN NameEvent ne ON np.npID = ne.ID
          WHERE np.npFileName = @fileName
        `);
      
      if (namePhotoResult.recordset.length > 0) {
        console.log('\n  Associated people/events:');
        namePhotoResult.recordset.forEach(np => {
          console.log(`    - ${np.neName}`);
        });
      }
    } else {
      console.log('\n❌ MP4 file NOT found in database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
  }
}

main().catch(console.error);
