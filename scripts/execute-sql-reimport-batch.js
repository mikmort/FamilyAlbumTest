#!/usr/bin/env node

/**
 * Reimport using Batch SQL Statements
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

if (!config.server) {
  console.error('ERROR: Missing connection details');
  process.exit(1);
}

console.log('\n=== SQL Reimport (Batch Statements) ===\n');

function parseCSVLine(line) {
  return line.split(',').map(v => v.trim());
}

function escapeSQL(str) {
  if (!str || str === '') return 'NULL';
  const s = String(str).replace(/'/g, "''");  // Escape single quotes by doubling them
  return `N'${s}'`;
}

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    console.log('✓ Connected\n');

    // Step 1: Clear
    console.log('[1] Clearing data...');
    const req1 = new sql.Request(pool);
    await req1.query('DELETE FROM dbo.NamePhoto; DELETE FROM dbo.Pictures; DELETE FROM dbo.NameEvent;');
    await req1.query(`DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);`);
    console.log('✓ Cleared\n');

    // Step 2: Import People as batch
    console.log('[2] Importing 358 people...');
    const peopleCSV = fs.readFileSync('C:\\Temp\\people_export.csv', 'utf-8');
    const peopleLines = peopleCSV.trim().split('\n').slice(1);
    
    let peopleBatch = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (const line of peopleLines) {
      const [id, name, relation, type, datemod, count] = parseCSVLine(line);
      peopleBatch += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, ${escapeSQL(name)}, ${escapeSQL(relation)}, ${escapeSQL(type)}, ${escapeSQL(datemod)}, ${count || '0'});\n`;
    }
    peopleBatch += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    const req2 = new sql.Request(pool);
    req2.timeout = 600000;
    await req2.query(peopleBatch);
    console.log(`✓ Imported ${peopleLines.length} people\n`);

    // Step 3: Import Events as batch
    console.log('[3] Importing 157 events...');
    const eventsCSV = fs.readFileSync('C:\\Temp\\events_export.csv', 'utf-8');
    const eventsLines = eventsCSV.trim().split('\n').slice(1);
    
    let eventsBatch = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (const line of eventsLines) {
      const [id, name, relation, type, datemod, count] = parseCSVLine(line);
      eventsBatch += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, ${escapeSQL(name)}, ${escapeSQL(relation)}, ${escapeSQL(type)}, ${escapeSQL(datemod)}, ${count || '0'});\n`;
    }
    eventsBatch += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    const req3 = new sql.Request(pool);
    req3.timeout = 600000;
    await req3.query(eventsBatch);
    console.log(`✓ Imported ${eventsLines.length} events\n`);

    // Step 4: Verify
    console.log('[4] Verifying...\n');
    const req4 = new sql.Request(pool);
    const result = await req4.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People,
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events;
    `);
    
    const counts = result.recordsets[0][0];
    console.log(`  ✓ People: ${counts.People}`);
    console.log(`  ✓ Events: ${counts.Events}\n`);

    // Step 5: Sample verification
    console.log('[5] Sample IDs:\n');
    const req5 = new sql.Request(pool);
    const sampleResult = await req5.query(`
      SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;
    `);
    sampleResult.recordsets[0].forEach(row => {
      console.log(`  ✓ ID ${row.ID}: ${row.neName}`);
    });

    console.log('\n✅ REIMPORT COMPLETE\n');
    console.log('Backend will restart and refresh (~2-3 minutes)\n');

    await pool.close();

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    if (err.stack) {
      const lines = err.stack.split('\n');
      console.error(lines[0]);
      console.error(lines[1]);
    }
    process.exit(1);
  }
})();
