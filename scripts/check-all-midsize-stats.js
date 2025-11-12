const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    user: 'familyadmin',
    password: 'Jam3jam3!',
    options: { encrypt: true }
  });
  
  console.log('\n📊 Checking ALL midsize statistics...\n');
  
  // Total images
  const total = await pool.request().query(`
    SELECT COUNT(*) as count FROM Pictures WHERE PType = 1
  `);
  console.log('Total images in database:', total.recordset[0].count);
  
  // Images WITHOUT midsize
  const withoutMidsize = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 AND PMidsizeUrl IS NULL
  `);
  console.log('Images WITHOUT midsize URL:', withoutMidsize.recordset[0].count);
  
  // Images WITH midsize
  const withMidsize = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 AND PMidsizeUrl IS NOT NULL
  `);
  console.log('Images WITH midsize URL:', withMidsize.recordset[0].count);
  
  // Images without midsize AND with BlobUrl (ready to process)
  const readyToProcess = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NOT NULL
  `);
  console.log('Images ready to process (has BlobUrl):', readyToProcess.recordset[0].count);
  
  // Images without midsize but NO BlobUrl
  const missingBlob = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NULL
  `);
  console.log('Images missing BlobUrl:', missingBlob.recordset[0].count);
  
  // Sample some images with midsize to see format
  console.log('\nSample images WITH midsize:');
  const withSample = await pool.request().query(`
    SELECT TOP 5 PFileName, PMidsizeUrl
    FROM Pictures
    WHERE PType = 1 AND PMidsizeUrl IS NOT NULL
  `);
  withSample.recordset.forEach(img => {
    console.log(`  ${img.PFileName} → ${img.PMidsizeUrl}`);
  });
  
  // Sample images without midsize
  console.log('\nSample images WITHOUT midsize (most recent):');
  const withoutSample = await pool.request().query(`
    SELECT TOP 10 PFileName, PBlobUrl, PMidsizeUrl
    FROM Pictures
    WHERE PType = 1 AND PMidsizeUrl IS NULL
    ORDER BY PDateEntered DESC
  `);
  withoutSample.recordset.forEach(img => {
    console.log(`  ${img.PFileName}`);
    console.log(`    Blob: ${img.PBlobUrl || 'NULL'}`);
    console.log(`    Midsize: ${img.PMidsizeUrl || 'NULL'}`);
  });
  
  await pool.close();
})();
