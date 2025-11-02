#!/usr/bin/env node

/**
 * Final Reimport - Proper CSV Parsing + Batch SQL
 */

const sql = require('mssql');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

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

console.log('\n=== SQL Reimport (Final) ===\n');

function escapeSQL(val) {
  if (!val || val === '') return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `N'${s}'`;
}

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    console.log('✓ Connected\n');

    const req = new sql.Request(pool);

    // Step 1: Clear
    console.log('[1] Clearing data...');
    await req.query('DELETE FROM dbo.NamePhoto; DELETE FROM dbo.Pictures; DELETE FROM dbo.NameEvent;');
    await req.query(`DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);`);
    console.log('✓ Cleared\n');

    // Step 2: Import People
    console.log('[2] Importing people (CSV parse)...');
    const peopleTxt = fs.readFileSync('C:\\Temp\\people_export.csv', 'utf-8');
    const peopleData = parse(peopleTxt, { columns: true, skip_empty_lines: true });
    
    let peopleSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (const row of peopleData) {
      peopleSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${row.ID}, ${escapeSQL(row.neName)}, ${escapeSQL(row.neRelation)}, ${escapeSQL(row.neType)}, ${escapeSQL(row.neDateLastModified)}, ${row.neCount || '0'});\n`;
    }
    peopleSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    const req1 = new sql.Request(pool);
    req1.timeout = 600000;
    await req1.query(peopleSql);
    console.log(`✓ Imported ${peopleData.length} people\n`);

    // Step 3: Import Events
    console.log('[3] Importing events (CSV parse)...');
    const eventsTxt = fs.readFileSync('C:\\Temp\\events_export.csv', 'utf-8');
    const eventsData = parse(eventsTxt, { columns: true, skip_empty_lines: true });
    
    let eventsSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (const row of eventsData) {
      eventsSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${row.ID}, ${escapeSQL(row.neName)}, ${escapeSQL(row.neRelation)}, ${escapeSQL(row.neType)}, ${escapeSQL(row.neDateLastModified)}, ${row.neCount || '0'});\n`;
    }
    eventsSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    
    const req2 = new sql.Request(pool);
    req2.timeout = 600000;
    await req2.query(eventsSql);
    console.log(`✓ Imported ${eventsData.length} events\n`);

    // Step 4: Verify
    console.log('[4] Verifying...\n');
    const req3 = new sql.Request(pool);
    const result = await req3.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People,
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events;
    `);
    
    const counts = result.recordsets[0][0];
    console.log(`  ✓ People: ${counts.People}`);
    console.log(`  ✓ Events: ${counts.Events}\n`);

    // Step 5: Sample
    console.log('[5] Sample IDs:\n');
    const req4 = new sql.Request(pool);
    const sampleResult = await req4.query(`
      SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;
    `);
    sampleResult.recordsets[0].forEach(row => {
      console.log(`  ✓ ID ${row.ID}: ${row.neName}`);
    });

    console.log('\n✅ REIMPORT COMPLETE!\n');
    console.log('People and Events with original SQLite IDs have been restored');
    console.log('Backend will restart and refresh cache (~2-3 minutes)\n');

    await pool.close();

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  }
})();
