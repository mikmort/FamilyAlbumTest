#!/usr/bin/env node

/**
 * Simple CSV Parser and SQL Reimport
 */

const sql = require('mssql');
const fs = require('fs');

const config = {
  server: process.env.AZURE_SQL_SERVER,
  authentication: {
    type: 'default',
    options: {
      userName: process.env.AZURE_SQL_USER,
      password: process.env.AZURE_SQL_PASSWORD
    }
  },
  options: {
    database: 'FamilyAlbum',
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 600000
  }
};

if (!config.server || !config.authentication.options.userName || !config.authentication.options.password) {
  console.error('ERROR: Missing Azure SQL connection details');
  process.exit(1);
}

// Simple CSV parser for unquoted values
function parseCSVLine(line) {
  return line.split(',');
}

console.log('\n=== SQL Reimport (CSV Direct) ===\n');
console.log(`Server: ${config.server}`);
console.log(`Database: ${config.options.database}\n`);

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    console.log('✓ Connected\n');

    const request = new sql.Request(pool);
    request.timeout = 600000;

    // Step 1: Clear data
    console.log('[1] Clearing existing data...');
    await request.query('DELETE FROM dbo.NamePhoto;');
    await request.query('DELETE FROM dbo.Pictures;');
    await request.query('DELETE FROM dbo.NameEvent;');
    await request.query(`DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);`);
    console.log('✓ Cleared\n');

    // Step 2: Import People
    console.log('[2] Importing People...');
    const peopleCSV = fs.readFileSync('C:\\Temp\\people_export.csv', 'utf-8');
    const peopleLines = peopleCSV.trim().split('\n');
    
    let peopleSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (let i = 1; i < peopleLines.length; i++) {
      const parts = parseCSVLine(peopleLines[i]);
      const id = parts[0];
      const name = parts[1]?.replace(/'/g, "''") || '';
      const relation = parts[2]?.replace(/'/g, "''") || '';
      const type = parts[3] || 'N';
      const datemod = parts[4] || 'GETDATE()';
      const count = parts[5] || '0';
      
      peopleSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, N'${name}', N'${relation}', '${type}', '${datemod}', ${count});\n`;
      
      if (i % 50 === 0) {
        peopleSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF; SET IDENTITY_INSERT dbo.NameEvent ON;\n';
      }
    }
    peopleSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    await request.query(peopleSql);
    console.log(`✓ Imported ${peopleLines.length - 1} people\n`);

    // Step 3: Import Events
    console.log('[3] Importing Events...');
    const eventsCSV = fs.readFileSync('C:\\Temp\\events_export.csv', 'utf-8');
    const eventsLines = eventsCSV.trim().split('\n');
    
    let eventsSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (let i = 1; i < eventsLines.length; i++) {
      const parts = parseCSVLine(eventsLines[i]);
      const id = parts[0];
      const name = parts[1]?.replace(/'/g, "''") || '';
      const relation = parts[2]?.replace(/'/g, "''") || '';
      const type = parts[3] || 'E';
      const datemod = parts[4] || 'GETDATE()';
      const count = parts[5] || '0';
      
      eventsSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, N'${name}', N'${relation}', '${type}', '${datemod}', ${count});\n`;
    }
    eventsSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    await request.query(eventsSql);
    console.log(`✓ Imported ${eventsLines.length - 1} events\n`);

    // Step 4: Verify
    console.log('[4] Verifying data...\n');
    const result = await request.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People,
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events;
    `);
    
    const counts = result.recordsets[0][0];
    console.log(`  People: ${counts.People}`);
    console.log(`  Events: ${counts.Events}\n`);

    // Step 5: Verify sample IDs
    console.log('[5] Verifying sample IDs...\n');
    const sampleResult = await request.query(`SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;`);
    console.log('Sample people:');
    sampleResult.recordsets[0].forEach(row => {
      console.log(`  ID ${row.ID}: ${row.neName}`);
    });

    console.log('\n✓ People/Events reimport COMPLETE\n');
    console.log('Note: Pictures and NamePhoto not yet imported in this version');
    console.log('Backend will restart and cache will refresh (~2-3 minutes)\n');

    await pool.close();

  } catch (err) {
    console.error('\n✗ FAILED:', err.message);
    console.error(err.stack?.split('\n')[0]);
    process.exit(1);
  }
})();
