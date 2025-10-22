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

async function dropConstraint() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    console.log('Dropping CHECK constraint on PType...');
    
    await pool.request()
      .query('ALTER TABLE dbo.Pictures DROP CONSTRAINT CK__Pictures__PType__778AC167');
    
    console.log('✓ Constraint dropped');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

dropConstraint();
