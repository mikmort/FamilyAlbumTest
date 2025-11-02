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

async function checkNamePhoto548() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    
    // Check for npID=548 with DSC04780 filename
    const result = await pool.request()
      .input('id', sql.Int, 548)
      .query('SELECT npID, npFileName FROM dbo.NamePhoto WHERE npID = @id AND npFileName LIKE \'%DSC04780%\'');
    
    console.log('NamePhoto records with npID=548 and DSC04780 filename:');
    console.log('Found:', result.recordset.length);
    result.recordset.forEach(r => {
      console.log('  npID:', r.npID);
      console.log('  npFileName:', r.npFileName);
    });
    
    if (result.recordset.length === 0) {
      // Check all NamePhoto records for npID=548
      console.log('\nAll NamePhoto records with npID=548 (first 10):');
      const all548 = await pool.request()
        .input('id', sql.Int, 548)
        .query('SELECT TOP 10 npID, npFileName FROM dbo.NamePhoto WHERE npID = @id ORDER BY npFileName');
      
      console.log('Found:', all548.recordset.length);
      all548.recordset.forEach(r => {
        console.log('  ', r.npFileName);
      });
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

checkNamePhoto548();
