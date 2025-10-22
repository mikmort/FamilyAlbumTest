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

async function verify() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    console.log('✓ Connected to Azure SQL');
    
    // Find DSC04780
    const result = await pool.request()
      .query('SELECT TOP 1 PFileName, PPeopleList FROM dbo.Pictures WHERE PFileName LIKE \'%DSC04780%\' ORDER BY PFileName DESC');
    
    if (result.recordset.length > 0) {
      const row = result.recordset[0];
      console.log('\n✓ DSC04780 found:');
      console.log('  Filename:', row.PFileName);
      console.log('  PPeopleList:', row.PPeopleList);
      
      if (row.PPeopleList) {
        const ids = row.PPeopleList.split(',').map(x => x.trim()).filter(x => x);
        console.log('  IDs to lookup:', ids.join(', '));
        
        const placeholders = ids.map((_, i) => '@id' + i).join(',');
        const req = pool.request();
        ids.forEach((id, i) => {
          req.input('id' + i, sql.Int, parseInt(id));
        });
        
        const lookupResult = await req
          .query('SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (' + placeholders + ') AND neType = \'N\' ORDER BY ID');
        
        console.log('  \n✓ Resolved People:');
        lookupResult.recordset.forEach(r => {
          console.log('    ID ' + r.ID + ': ' + r.neName);
        });
        
        // Check for missing IDs (likely events)
        const foundIds = lookupResult.recordset.map(r => r.ID);
        const missingIds = ids.filter(id => !foundIds.includes(parseInt(id)));
        if (missingIds.length > 0) {
          console.log('  \n✓ Event IDs (not people):');
          missingIds.forEach(id => {
            console.log('    ID ' + id + ': [Event]');
          });
        }
      }
    } else {
      console.log('✗ DSC04780 not found');
    }
  } catch (err) {
    console.error('✗ Error:', err.message);
  } finally {
    await pool.close();
  }
}

verify();
