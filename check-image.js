const sql = require('mssql');

(async () => {
  const pool = await sql.connect({
    server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
    database: 'FamilyAlbum',
    user: 'familyadmin',
    password: 'Jam3jam3!',
    options: { encrypt: true }
  });
  
  const result = await pool.request().query(`
    SELECT TOP 20 
      PFileName, 
      PWidth, 
      PHeight, 
      PMidsizeUrl
    FROM Pictures 
    WHERE PType = 1 
    AND PMidsizeUrl IS NULL
    AND (
      PWidth > 1080 
      OR PHeight > 1080 
      OR PWidth IS NULL 
      OR PHeight IS NULL
    )
    ORDER BY PDateEntered DESC
  `);
  
  console.log('Images that should be processed for midsize:');
  console.log(JSON.stringify(result.recordset, null, 2));
  
  await pool.close();
})();
