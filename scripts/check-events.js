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

async function checkEvents() {
  const pool = new sql.ConnectionPool(config);
  try {
    await pool.connect();
    
    // Get all events
    const result = await pool.request()
      .query(`SELECT ID, neName FROM dbo.NameEvent WHERE neType = 'E' ORDER BY ID`);
    
    console.log('Total Events:', result.recordset.length);
    console.log('\nAll Events:');
    result.recordset.forEach((r, i) => {
      console.log(`  ${i+1}. ID ${r.ID}: ${r.neName}`);
    });
    
    // Check DSC04780 event list
    console.log('\n--- DSC04780 Events ---');
    const pic = await pool.request()
      .query(`SELECT PPeopleList, PEventList FROM dbo.Pictures WHERE PFileName LIKE '%DSC04780%'`);
    
    if (pic.recordset.length > 0) {
      console.log('PEventList:', pic.recordset[0].PEventList);
      if (pic.recordset[0].PEventList) {
        const eventIds = pic.recordset[0].PEventList.split(',').map(x => x.trim());
        console.log('Event IDs:', eventIds.join(', '));
        
        // Look up those events
        const placeholders = eventIds.map((_, i) => '@id' + i).join(',');
        const req = pool.request();
        eventIds.forEach((id, i) => {
          req.input('id' + i, sql.Int, parseInt(id));
        });
        
        const eventLookup = await req
          .query(`SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (${placeholders})`);
        
        console.log('Resolved Events:');
        eventLookup.recordset.forEach(r => {
          console.log(`  ID ${r.ID}: ${r.neName}`);
        });
      }
    }
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

checkEvents();
