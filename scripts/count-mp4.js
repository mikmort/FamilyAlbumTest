const sql = require('mssql');
const config = require('../api/local.settings.json').Values;

async function countMp4Files() {
  try {
    const pool = await sql.connect({
      server: config.AZURE_SQL_SERVER,
      database: config.AZURE_SQL_DATABASE,
      user: config.AZURE_SQL_USER,
      password: config.AZURE_SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: false }
    });

    const result = await pool.request().query(`
      SELECT COUNT(*) as count 
      FROM Pictures 
      WHERE LOWER(PFileName) LIKE '%.mp4'
    `);

    console.log(`\n✅ Total MP4 files in database: ${result.recordset[0].count}\n`);

    await pool.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

countMp4Files();
