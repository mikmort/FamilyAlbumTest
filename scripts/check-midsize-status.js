const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    user: 'familyadmin',
    password: 'Jam3jam3!',
    options: { encrypt: true }
  });
  
  const filename = 'Miscellaneous Pictures/20210903_194524.jpg';
  
  const result = await pool.request()
    .input('filename', sql.NVarChar, filename)
    .query(`
      SELECT PFileName, PMidsizeUrl, 
             DATALENGTH(PFileName) as FilenameLength,
             DATALENGTH(PMidsizeUrl) as MidsizeUrlLength
      FROM Pictures 
      WHERE PFileName = @filename
    `);
  
  console.log('\nChecking midsize URL for:', filename);
  console.log('Results:', result.recordset);
  
  if (result.recordset.length === 0) {
    console.log('\n❌ File not found in database');
  } else {
    const row = result.recordset[0];
    if (row.PMidsizeUrl) {
      console.log('\n✅ HAS midsize URL:', row.PMidsizeUrl);
    } else {
      console.log('\n❌ NO midsize URL - this is an old file from before midsize feature');
      console.log('   You need to run the batch midsize generation from Admin Settings');
    }
  }
  
  // Check total stats
  const stats = await pool.request().query(`
    SELECT 
      COUNT(*) as TotalImages,
      COUNT(PMidsizeUrl) as WithMidsize,
      COUNT(*) - COUNT(PMidsizeUrl) as MissingMidsize
    FROM Pictures
    WHERE PType = 1
  `);
  
  console.log('\n📊 Overall midsize status:');
  console.log(stats.recordset[0]);
  
  await pool.close();
})();
