const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function checkRemainingMov() {
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
      WHERE LOWER(PFileName) LIKE '%.mov' 
      ORDER BY PFileName
    `);

    console.log(`\n📊 Remaining MOV files in database: ${result.recordset.length}\n`);
    
    if (result.recordset.length > 0) {
      result.recordset.forEach(r => console.log(`  - ${r.PFileName}`));
    } else {
      console.log('✅ All MOV files have been converted to MP4!');
    }

    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRemainingMov();
