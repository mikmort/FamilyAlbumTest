#!/usr/bin/env node

/**
 * Execute SQL Reimport - Using Direct CSV Reading
 * 
 * This version bypasses BULK INSERT and uses a direct approach
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
    requestTimeout: 600000  // 10 minutes
  }
};

if (!config.server || !config.authentication.options.userName || !config.authentication.options.password) {
  console.error('ERROR: Missing Azure SQL connection details');
  process.exit(1);
}

console.log('\n=== SQL Reimport (Direct Approach) ===');
console.log(`Server: ${config.server}`);
console.log(`Database: ${config.options.database}\n`);

async function executeQuery(request, name, sql) {
  console.log(`  Executing: ${name}`);
  try {
    const result = await request.query(sql);
    if (result.recordsets && result.recordsets.length > 0) {
      result.recordsets.forEach((rs, idx) => {
        if (rs.length > 0) {
          console.log(`    ✓ Result: ${JSON.stringify(rs[0])}`);
        }
      });
    }
    console.log(`  ✓ ${name} completed\n`);
  } catch (err) {
    console.error(`  ✗ Error: ${err.message}`);
    throw err;
  }
}

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    await sql.connect(config);
    console.log('✓ Connected\n');

    const request = new sql.Request();
    request.timeout = 600000;

    console.log('[1] Clearing existing data...\n');
    await executeQuery(request, 'Delete NamePhoto', 'DELETE FROM dbo.NamePhoto;');
    await executeQuery(request, 'Delete Pictures', 'DELETE FROM dbo.Pictures;');
    await executeQuery(request, 'Delete NameEvent', 'DELETE FROM dbo.NameEvent;');
    await executeQuery(request, 'Reset IDENTITY', `DBCC CHECKIDENT ('dbo.NameEvent', RESEED, 0);`);

    console.log('[2] Importing People (358 rows)...\n');
    
    // Read CSV and insert directly
    const peopleCSV = fs.readFileSync('C:\\Temp\\people_export.csv', 'utf-8');
    const peopleLines = peopleCSV.trim().split('\n').slice(1); // Skip header
    
    // Prepare all inserts in one batch with IDENTITY_INSERT ON
    let peopleSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    let peopleInserted = 0;
    
    for (let i = 0; i < peopleLines.length; i++) {
      const line = peopleLines[i];
      const [id, name, relation, type, dateModified, count] = line.split(',');
      
      const cleanName = name?.trim().replace(/'/g, "''") || '';
      const cleanRelation = relation?.trim().replace(/'/g, "''") || '';
      const cleanType = type?.trim() || 'N';
      const cleanDateMod = dateModified?.trim() || 'GETDATE()';
      const cleanCount = count?.trim() || '0';
      
      peopleSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, N'${cleanName}', N'${cleanRelation}', '${cleanType}', '${cleanDateMod}', ${cleanCount});\n`;
      
      // Execute in batches of 50 to avoid timeout
      if ((i + 1) % 50 === 0 || i === peopleLines.length - 1) {
        peopleSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
        await request.query(peopleSql);
        peopleInserted += Math.min(50, i - peopleInserted + 1);
        process.stdout.write(`  \rInserted ${i + 1}/${peopleLines.length} people...`);
        peopleSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
      }
    }
    
    console.log(`\n  ✓ Inserted ${peopleLines.length} people\n`);

    console.log('[3] Importing Events (157 rows)...\n');
    
    const eventsCSV = fs.readFileSync('C:\\Temp\\events_export.csv', 'utf-8');
    const eventsLines = eventsCSV.trim().split('\n').slice(1);
    
    let eventsSql = 'SET IDENTITY_INSERT dbo.NameEvent ON;\n';
    for (let i = 0; i < eventsLines.length; i++) {
      const line = eventsLines[i];
      const [id, name, relation, type, dateModified, count] = line.split(',');
      
      const cleanName = name?.trim().replace(/'/g, "''") || '';
      const cleanRelation = relation?.trim().replace(/'/g, "''") || '';
      const cleanType = type?.trim() || 'E';
      const cleanDateMod = dateModified?.trim() || 'GETDATE()';
      const cleanCount = count?.trim() || '0';
      
      eventsSql += `INSERT INTO dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) VALUES (${id}, N'${cleanName}', N'${cleanRelation}', '${cleanType}', '${cleanDateMod}', ${cleanCount});\n`;
    }
    eventsSql += 'SET IDENTITY_INSERT dbo.NameEvent OFF;';
    await request.query(eventsSql);
    console.log(`  ✓ Inserted ${eventsLines.length} events\n`);

    console.log('[4] Importing Pictures (9717 rows)...\n');
    
    const picturesCSV = fs.readFileSync('C:\\Temp\\pictures_export.csv', 'utf-8');
    const picturesLines = picturesCSV.trim().split('\n').slice(1);
    
    let picturesInserted = 0;
    for (const line of picturesLines) {
      // CSV columns: PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount
      const parts = line.split(',');
      const fileName = parts[0].trim();
      const fileDir = parts[1].trim();
      const desc = parts[2]?.trim() || null;
      const height = parts[3]?.trim() || null;
      const width = parts[4]?.trim() || null;
      const peopleList = parts[5]?.trim() || null;
      const month = parts[6]?.trim() || null;
      const year = parts[7]?.trim() || null;
      const soundFile = parts[8]?.trim() || null;
      const dateEntered = parts[9]?.trim() || null;
      const type = parts[10]?.trim() || null;
      const lastMod = parts[11]?.trim() || null;
      const reviewed = parts[12]?.trim() || null;
      const time = parts[13]?.trim() || null;
      const nameCount = parts[14]?.trim() || null;
      
      await request.input('pfilename', sql.NVarChar(500), fileName);
      await request.input('pfiledirectory', sql.NVarChar(1000), fileDir);
      await request.input('pdescription', sql.NVarChar(sql.MAX), desc);
      await request.input('pheight', sql.Int, height ? parseInt(height) : null);
      await request.input('pwidth', sql.Int, width ? parseInt(width) : null);
      await request.input('ppeoplelist', sql.NVarChar(sql.MAX), peopleList);
      await request.input('pmonth', sql.Int, month ? parseInt(month) : null);
      await request.input('pyear', sql.Int, year ? parseInt(year) : null);
      await request.input('psoundfile', sql.NVarChar(500), soundFile);
      await request.input('pdateentered', sql.DateTime2, dateEntered);
      await request.input('ptype', sql.Int, type ? parseInt(type) : 1);
      await request.input('plastmodified', sql.DateTime2, lastMod);
      await request.input('previewed', sql.Bit, reviewed ? (reviewed === 'True' ? 1 : 0) : 0);
      await request.input('ptime', sql.Int, time ? parseInt(time) : 0);
      await request.input('pnamecount', sql.Int, nameCount ? parseInt(nameCount) : 0);
      
      await request.query(`INSERT INTO dbo.Pictures (PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount)
        VALUES (@pfilename, @pfiledirectory, @pdescription, @pheight, @pwidth, @ppeoplelist, @pmonth, @pyear, @psoundfile, @pdateentered, @ptype, @plastmodified, @previewed, @ptime, @pnamecount);`);
      
      picturesInserted++;
      if (picturesInserted % 500 === 0) {
        process.stdout.write(`  \rInserted ${picturesInserted} pictures...`);
      }
    }
    console.log(`  ✓ Inserted ${picturesInserted} pictures\n`);

    console.log('[5] Importing NamePhoto (28700 rows)...\n');
    
    const namephotoCSV = fs.readFileSync('C:\\Temp\\namephoto_export.csv', 'utf-8');
    const namephotoLines = namephotoCSV.trim().split('\n').slice(1);
    
    let namephotoInserted = 0;
    for (const line of namephotoLines) {
      const [npid, npfilename] = line.split(',').map(v => v.trim());
      await request.input('npid', sql.Int, parseInt(npid));
      await request.input('npfilename', sql.NVarChar(500), npfilename);
      
      await request.query(`INSERT INTO dbo.NamePhoto (npID, npFileName) VALUES (@npid, @npfilename);`);
      
      namephotoInserted++;
      if (namephotoInserted % 1000 === 0) {
        process.stdout.write(`  \rInserted ${namephotoInserted} associations...`);
      }
    }
    console.log(`  ✓ Inserted ${namephotoInserted} associations\n`);

    console.log('[6] Verifying data...\n');
    
    const result = await request.query(`
      SELECT 
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People,
        (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events,
        (SELECT COUNT(*) FROM dbo.Pictures) AS Pictures,
        (SELECT COUNT(*) FROM dbo.NamePhoto) AS Associations;
    `);
    
    if (result.recordsets[0].length > 0) {
      const counts = result.recordsets[0][0];
      console.log(`  People: ${counts.People}`);
      console.log(`  Events: ${counts.Events}`);
      console.log(`  Pictures: ${counts.Pictures}`);
      console.log(`  Associations: ${counts.Associations}\n`);
    }

    console.log('[7] Verifying sample IDs...\n');
    
    const sampleResult = await request.query(`SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;`);
    console.log('Sample people:');
    sampleResult.recordsets[0].forEach(row => {
      console.log(`  ID ${row.ID}: ${row.neName}`);
    });

    console.log('\n✓ REIMPORT COMPLETE\n');
    console.log('The backend will restart and refresh cache (~2-3 minutes)\n');

  } catch (err) {
    console.error('\n✗ REIMPORT FAILED:', err.message);
    process.exit(1);
  } finally {
    await sql.close();
    console.log('✓ Connection closed');
  }
})();
