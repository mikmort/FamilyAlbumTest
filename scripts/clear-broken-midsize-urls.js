const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function clearBrokenMidsizeUrls() {
  let pool;
  
  try {
    pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });
    console.log('✅ Connected to database\n');

    // Find all images with backslash directories AND midsize URLs set
    // These are the ones with mixed-slash blob paths
    const result = await pool.request().query(`
      SELECT COUNT(*) as Count
      FROM Pictures
      WHERE PFileDirectory LIKE '%\\%'
        AND PMidsizeUrl IS NOT NULL
    `);

    const count = result.recordset[0].Count;
    console.log(`Found ${count} images with backslash directories and midsize URLs set\n`);
    console.log('These images likely have blobs stored with mixed slashes (media/Dir\\Subdir/file-midsize.jpg)\n');

    // Clear the PMidsizeUrl for these images so they'll be regenerated
    console.log('Clearing PMidsizeUrl for these images...\n');
    
    const updateResult = await pool.request().query(`
      UPDATE Pictures
      SET PMidsizeUrl = NULL,
          PLastModifiedDate = GETDATE()
      WHERE PFileDirectory LIKE '%\\%'
        AND PMidsizeUrl IS NOT NULL
    `);

    console.log(`✅ Cleared PMidsizeUrl for ${updateResult.rowsAffected[0]} images\n`);
    console.log('Now run the generate-midsize batch process to recreate them with correct paths:\n');
    console.log('  POST https://www.mortonfamilyalbum.com/api/generate-midsize/batch\n');
    console.log('This will regenerate all midsize images with proper forward-slash paths.');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    if (pool) await pool.close();
  }
}

clearBrokenMidsizeUrls();
