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

async function checkEvent548() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    
    // Check event 548
    const result = await pool.request()
      .input('id', sql.Int, 548)
      .query('SELECT ID, neName, neType FROM dbo.NameEvent WHERE ID = @id');
    
    console.log('Event ID 548:');
    if (result.recordset.length > 0) {
      const r = result.recordset[0];
      console.log(`  ID: ${r.ID}`);
      console.log(`  Name: ${r.neName}`);
      console.log(`  Type: ${r.neType} ${r.neType === 'E' ? '✓ (Event)' : '✗ (NOT an event!)'}`);
    } else {
      console.log('  NOT FOUND!');
    }
    
    // Check if 548 appears in any NamePhoto associations
    console.log('\nNamePhoto associations with ID 548:');
    const npResult = await pool.request()
      .input('id', sql.Int, 548)
      .query('SELECT npID, npFileName FROM dbo.NamePhoto WHERE npID = 548 LIMIT 5');
    
    console.log(`  Found ${npResult.recordset.length} associations`);
    npResult.recordset.forEach((r, i) => {
      console.log(`    ${i+1}. ${r.npFileName}`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

checkEvent548();
