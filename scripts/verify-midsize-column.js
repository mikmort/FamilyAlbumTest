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
    SELECT COLUMN_NAME, DATA_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_NAME = 'Pictures' 
    AND COLUMN_NAME IN ('PMidsizeUrl')
  `);
  
  console.log('\nPMidsizeUrl column status:');
  if (result.recordset.length > 0) {
    console.log('✅ EXISTS');
    console.log(result.recordset);
  } else {
    console.log('❌ MISSING - Migration did not add the column');
  }
  
  await pool.close();
})();
