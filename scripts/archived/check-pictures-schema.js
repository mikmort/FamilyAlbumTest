const sql = require('mssql');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  authentication: {
    type: 'default',
    options: { 
      userName: process.env.AZURE_SQL_USER, 
      password: process.env.AZURE_SQL_PASSWORD 
    }
  },
  options: { encrypt: true, trustServerCertificate: false },
  database: 'FamilyAlbum'
};

async function checkSchema() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    const result = await pool.request()
      .query('SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = \'Pictures\' ORDER BY ORDINAL_POSITION');
    
    console.log('Pictures table columns:');
    result.recordset.forEach(r => {
      console.log('  ' + r.COLUMN_NAME + ': ' + r.DATA_TYPE);
    });

    console.log('\nNamePhoto table columns:');
    const nphResult = await pool.request()
      .query('SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = \'NamePhoto\' ORDER BY ORDINAL_POSITION');
    
    nphResult.recordset.forEach(r => {
      console.log('  ' + r.COLUMN_NAME + ': ' + r.DATA_TYPE);
    });
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

checkSchema();
