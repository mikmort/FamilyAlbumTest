const sql = require('mssql');

const config = {
  server: 'familyalbum-prod-sql-gajerhxssqswm.database.windows.net',
  database: 'FamilyAlbum',
  user: 'familyadmin',
  password: 'Jam3jam3!',
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

async function checkFile() {
  try {
    await sql.connect(config);
    const result = await sql.query`
      SELECT PFileName, PDescription 
      FROM Pictures 
      WHERE PFileName LIKE '%5258%'
    `;
    console.log(`Found ${result.recordset.length} entries for MVI_5258:\n`);
    console.log(JSON.stringify(result.recordset, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    sql.close();
  }
}

checkFile();
