#!/usr/bin/env node

/**
 * Reimport using Parameterized Queries (Safe + Simple)
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
  console.error('ERROR: Missing connection details');
  process.exit(1);
}

console.log('\n=== SQL Reimport (Parameterized) ===\n');

function parseCSVLine(line) {
  return line.split(',').map(v => v.trim());
}

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    const pool = await sql.connect(config);
    console.log('✓ Connected\n');

    const request = new sql.Request(pool);
    request.timeout = 600000;

    // Step 1: Clear
    console.log('[1] Clearing existing data...');
    await request.query('DELETE FROM dbo.NamePhoto; DELETE FROM dbo.Pictures; DELETE FROM dbo.NameEvent;');
    await request.query(`DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);`);
    console.log('✓ Cleared\n');

    // Step 2: Import People
    console.log('[2] Importing 358 people...');
    const peopleCSV = fs.readFileSync('C:\\Temp\\people_export.csv', 'utf-8');
    const peopleLines = peopleCSV.trim().split('\n').slice(1);
    
    const transaction = pool.transaction();
    transaction.begin(async (err) => {
      if (err) throw err;
      
      const transReq = new sql.Request(transaction);
      transReq.timeout = 600000;
      
      await transReq.query('SET IDENTITY_INSERT dbo.NameEvent ON;');
      
      for (let i = 0; i < peopleLines.length; i++) {
        const [id, name, relation, type, datemod, count] = parseCSVLine(peopleLines[i]);
        
        transReq.input('id', sql.Int, id);
        transReq.input('name', sql.NVarChar(255), name);
        transReq.input('relation', sql.NVarChar(500), relation);
        transReq.input('type', sql.Char(1), type);
        transReq.input('datemod', sql.DateTime2, datemod || null);
        transReq.input('count', sql.Int, count ? parseInt(count) : 0);
        
        await transReq.query(`INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) 
          VALUES (@id, @name, @relation, @type, @datemod, @count);`);
        
        if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${peopleLines.length}\r`);
      }
      
      await transReq.query('SET IDENTITY_INSERT dbo.NameEvent OFF;');
      console.log(`✓ Imported ${peopleLines.length} people                 \n`);
      
      transaction.commit((err) => {
        if (err) throw err;
      });
    });

    // Step 3: Import Events
    console.log('[3] Importing 157 events...');
    const eventsCSV = fs.readFileSync('C:\\Temp\\events_export.csv', 'utf-8');
    const eventsLines = eventsCSV.trim().split('\n').slice(1);
    
    await request.query('SET IDENTITY_INSERT dbo.NameEvent ON;');
    
    for (let i = 0; i < eventsLines.length; i++) {
      const [id, name, relation, type, datemod, count] = parseCSVLine(eventsLines[i]);
      
      const insReq = new sql.Request(pool);
      insReq.input('id', sql.Int, id);
      insReq.input('name', sql.NVarChar(255), name);
      insReq.input('relation', sql.NVarChar(500), relation);
      insReq.input('type', sql.Char(1), type);
      insReq.input('datemod', sql.DateTime2, datemod || null);
      insReq.input('count', sql.Int, count ? parseInt(count) : 0);
      
      await insReq.query(`INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) 
        VALUES (@id, @name, @relation, @type, @datemod, @count);`);
    }
    
    await request.query('SET IDENTITY_INSERT dbo.NameEvent OFF;');
    console.log(`✓ Imported ${eventsLines.length} events\n`);

    // Step 4: Verify
    console.log('[4] Verifying...\n');
    const result = await request.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People,
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events;
    `);
    
    const counts = result.recordsets[0][0];
    console.log(`  ✓ People: ${counts.People}`);
    console.log(`  ✓ Events: ${counts.Events}\n`);

    // Step 5: Sample verification
    console.log('[5] Verifying sample IDs:\n');
    const sampleResult = await request.query(`
      SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;
    `);
    sampleResult.recordsets[0].forEach(row => {
      console.log(`  ✓ ID ${row.ID}: ${row.neName}`);
    });

    console.log('\n✅ REIMPORT COMPLETE - People and Events Updated\n');
    console.log('Backend will restart automatically and refresh cache (~2-3 minutes)\n');

    await pool.close();

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
    process.exit(1);
  }
})();
