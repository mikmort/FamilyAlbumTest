const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    user: 'familyadmin',
    password: 'Jam3jam3!',
    options: { encrypt: true }
  });
  
  console.log('\n🔍 Checking images for midsize generation...\n');
  
  // Check images without midsize
  const withoutMidsize = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NOT NULL
  `);
  console.log('Images without midsize URL:', withoutMidsize.recordset[0].count);
  
  // Check images without midsize that also have dimensions
  const withDimensions = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NOT NULL
    AND (PWidth > 1080 OR PHeight > 1080)
  `);
  console.log('Images >1080px with dimensions:', withDimensions.recordset[0].count);
  
  // Check how many have NULL dimensions
  const nullDimensions = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NOT NULL
    AND (PWidth IS NULL OR PHeight IS NULL)
  `);
  console.log('Images with NULL dimensions:', nullDimensions.recordset[0].count);
  
  // Sample some images to see what data we have
  const sample = await pool.request().query(`
    SELECT TOP 10
      PFileName,
      PWidth,
      PHeight,
      PMidsizeUrl,
      PBlobUrl
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND PBlobUrl IS NOT NULL
    ORDER BY PDateEntered DESC
  `);
  
  console.log('\nSample images (most recent 10):');
  sample.recordset.forEach(img => {
    console.log(`  ${img.PFileName}: ${img.PWidth || 'NULL'}x${img.PHeight || 'NULL'}`);
  });
  
  await pool.close();
})();
