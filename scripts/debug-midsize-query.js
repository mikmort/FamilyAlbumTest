const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    user: 'familyadmin',
    password: 'Jam3jam3!',
    options: { encrypt: true }
  });
  
  console.log('\n🔍 Debugging the query issue...\n');
  
  // What the API query returns (TOP 50)
  console.log('=== API Query (TOP 50) ===');
  const apiQuery = await pool.request().query(`
    SELECT TOP 50
        PFileName,
        PFileDirectory,
        PBlobUrl
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    ORDER BY PDateEntered DESC
  `);
  console.log(`Found ${apiQuery.recordset.length} images`);
  console.log('\nFirst 5 images:');
  apiQuery.recordset.slice(0, 5).forEach(img => {
    console.log(`  ${img.PFileName}`);
    console.log(`    Directory: ${img.PFileDirectory || 'NULL'}`);
    console.log(`    BlobUrl: ${img.PBlobUrl || 'NULL'}`);
  });
  
  // What the count query returns
  console.log('\n=== Count Query ===');
  const countQuery = await pool.request().query(`
    SELECT COUNT(*) as count
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
  `);
  console.log(`Total images needing midsize: ${countQuery.recordset[0].count}`);
  
  // Check if PFileDirectory has forward slashes or backslashes
  console.log('\n=== Sample Directory Formats ===');
  const dirSample = await pool.request().query(`
    SELECT DISTINCT TOP 10 PFileDirectory
    FROM Pictures
    WHERE PFileDirectory IS NOT NULL
    ORDER BY PDateEntered DESC
  `);
  dirSample.recordset.forEach(r => {
    console.log(`  "${r.PFileDirectory}"`);
  });
  
  // Check what blob paths look like in storage
  console.log('\n=== Constructed Blob Paths (Top 10) ===');
  const pathTest = await pool.request().query(`
    SELECT TOP 10
        PFileName,
        PFileDirectory,
        CASE 
            WHEN PFileDirectory IS NOT NULL 
            THEN 'media/' + PFileDirectory + '/' + PFileName
            ELSE 'media/' + PFileName
        END as ConstructedPath
    FROM Pictures
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    ORDER BY PDateEntered DESC
  `);
  pathTest.recordset.forEach(img => {
    console.log(`  ${img.ConstructedPath}`);
  });
  
  await pool.close();
})();
