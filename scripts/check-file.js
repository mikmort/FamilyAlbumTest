const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function checkFile() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });

    const result = await pool.request().query(`
      SELECT PFileName 
      FROM Pictures 
      WHERE PFileName LIKE '%MVI_5732%'
      ORDER BY PFileName
    `);

    console.log(`\n📂 Files matching MVI_5732:\n`);
    result.recordset.forEach(r => console.log(`  - ${r.PFileName}`));
    console.log();

    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkFile();
