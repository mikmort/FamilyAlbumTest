const sql = require('mssql');
const { BlobServiceClient } = require('@azure/storage-blob');
const config = require('../api/local.settings.json').Values;

async function checkMissingMidsizeBlobs() {
  let pool;
  
  try {
    // Connect to database
    pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });
    console.log('✅ Connected to database\n');

    // Check specific failing images from the error log
    const failingImages = [
      'Events/Whistler/DSC04536.JPG',
      'Events/Whistler/DSC04258.JPG',
      'Events/Whistler/20240711_211144.jpg',
      'Events/Whistler/20240711_132029.jpg',
      'Events/Whistler/2024_0712_14095600.jpg',
      'Slides/slides318.jpg',
      'Old Morton Pictures/Mikes Pictures/mik013.jpg',
      'Old Morton Pictures/Mikes Pictures/mik038.jpg',
      'Max and Tillie\'s 25th anniversary/the jeff morton family.jpg',
      'Scanned06/scn211.jpg',
      'Miscellaneous Pictures/DSC03127.JPG',
      'Miscellaneous Pictures/DSC02958.JPG',
      'Miscellaneous Pictures/DSC02924.JPG',
      'Family Pictures/Calendar2021/IMG_1019.jpg',
      'Family Pictures/Calendar2021/IMG_0118.jpg',
      'Events/Thanksgiving/Thanksgiving 2016/IMG_8253m.jpg',
      'Events/Thanksgiving/Thanksgiving 2016/IMG_8244.JPG'
    ];

    console.log('Checking failing images from error log:\n');
    
    for (const filename of failingImages) {
      // Query database
      const result = await pool.request()
        .input('filename', sql.NVarChar, filename)
        .query(`
          SELECT PFileName, PFileDirectory, PMidsizeUrl
          FROM Pictures 
          WHERE PFileName = @filename
        `);

      if (result.recordset.length === 0) {
        console.log(`❌ NOT IN DATABASE: ${filename}`);
        continue;
      }

      const img = result.recordset[0];
      console.log(`\n📁 ${filename}`);
      console.log(`   Dir: ${img.PFileDirectory}`);
      console.log(`   PMidsizeUrl: ${img.PMidsizeUrl || 'NULL'}`);

      if (img.PMidsizeUrl) {
        console.log(`   ⚠️  Has PMidsizeUrl but blob might be missing`);
      } else {
        console.log(`   ⚠️  No PMidsizeUrl set (midsize never generated)`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log('STATISTICS');
    console.log('='.repeat(80));

    // Overall statistics
    const stats = await pool.request().query(`
      SELECT 
        COUNT(*) as Total,
        SUM(CASE WHEN PMidsizeUrl IS NOT NULL THEN 1 ELSE 0 END) as WithMidsizeUrl,
        SUM(CASE WHEN PMidsizeUrl IS NULL THEN 1 ELSE 0 END) as WithoutMidsizeUrl,
        SUM(CASE WHEN PFileSize > 1048576 AND PMidsizeUrl IS NULL THEN 1 ELSE 0 END) as LargeWithoutMidsize
      FROM Pictures
      WHERE PFileName LIKE '%.jpg' OR PFileName LIKE '%.jpeg' OR PFileName LIKE '%.JPG' OR PFileName LIKE '%.JPEG'
    `);

    console.log(`\nTotal images: ${stats.recordset[0].Total}`);
    console.log(`With midsize URL: ${stats.recordset[0].WithMidsizeUrl}`);
    console.log(`Without midsize URL: ${stats.recordset[0].WithoutMidsizeUrl}`);
    console.log(`Large (>1MB) without midsize: ${stats.recordset[0].LargeWithoutMidsize}`);

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    if (pool) await pool.close();
  }
}

checkMissingMidsizeBlobs();
