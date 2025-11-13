const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function fixMidsizeUrls() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });

    // Get all images with midsize URLs
    const result = await pool.request().query(`
      SELECT PFileName, PFileDirectory, PMidsizeUrl
      FROM Pictures 
      WHERE PMidsizeUrl IS NOT NULL
    `);

    console.log(`\n📂 Found ${result.recordset.length} images with midsize URLs\n`);
    
    let fixed = 0;
    let skipped = 0;

    for (const image of result.recordset) {
      // Extract just the filename without directory
      const fileNameOnly = image.PFileName.split('/').pop().split('\\').pop();
      const fileExt = fileNameOnly.substring(fileNameOnly.lastIndexOf('.'));
      const baseName = fileNameOnly.substring(0, fileNameOnly.lastIndexOf('.'));
      const midsizeFileName = `${baseName}-midsize${fileExt}`;
      
      // Build correct API URL
      const dirForUrl = image.PFileDirectory ? image.PFileDirectory.replace(/\\/g, '/') : '';
      const correctUrl = dirForUrl 
        ? `/api/media/${dirForUrl}/${midsizeFileName}`
        : `/api/media/${midsizeFileName}`;

      if (image.PMidsizeUrl !== correctUrl) {
        console.log(`Fixing: ${image.PFileName}`);
        console.log(`  Old: ${image.PMidsizeUrl}`);
        console.log(`  New: ${correctUrl}`);
        
        await pool.request()
          .input('midsizeUrl', sql.NVarChar, correctUrl)
          .input('fileName', sql.NVarChar, image.PFileName)
          .query(`
            UPDATE Pictures
            SET PMidsizeUrl = @midsizeUrl
            WHERE PFileName = @fileName
          `);
        
        fixed++;
      } else {
        skipped++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} URLs`);
    console.log(`⏭️  Skipped ${skipped} (already correct)\n`);

    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixMidsizeUrls();
