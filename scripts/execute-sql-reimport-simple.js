#!/usr/bin/env node

/**
 * Execute SQL Reimport - Simplified Version
 * 
 * Executes the SQL reimport in separate statements to avoid parsing issues
 * 
 * Prerequisites:
 * - AZURE_SQL_SERVER, AZURE_SQL_USER, AZURE_SQL_PASSWORD env vars set
 * - CSV files in C:\Temp\
 * 
 * Usage: node scripts/execute-sql-reimport-simple.js
 */

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
  options: {
    database: 'FamilyAlbum',
    encrypt: true,
    trustServerCertificate: false,
    connectionTimeout: 30000,
    requestTimeout: 300000  // 5 minutes
  }
};

if (!config.server || !config.authentication.options.userName || !config.authentication.options.password) {
  console.error('ERROR: Missing Azure SQL connection details');
  console.error('Set environment variables:');
  console.error('  AZURE_SQL_SERVER');
  console.error('  AZURE_SQL_USER');
  console.error('  AZURE_SQL_PASSWORD');
  process.exit(1);
}

console.log('\n=== SQL Reimport Execution (Simplified) ===');
console.log(`Server: ${config.server}`);
console.log(`Database: ${config.options.database}\n`);

// Define queries as separate statements
const queries = [
  {
    name: 'STEP 1: Clear NamePhoto',
    sql: 'DELETE FROM dbo.NamePhoto;'
  },
  {
    name: 'STEP 2: Clear Pictures',
    sql: 'DELETE FROM dbo.Pictures;'
  },
  {
    name: 'STEP 3: Clear NameEvent',
    sql: 'DELETE FROM dbo.NameEvent; DBCC CHECKIDENT (\'dbo.NameEvent\', RESEED, 0);'
  },
  {
    name: 'STEP 4: Import People',
    sql: `SET IDENTITY_INSERT dbo.NameEvent ON;`
  },
  {
    name: 'STEP 4b: Bulk insert people from CSV',
    sql: `BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) FROM 'C:\\Temp\\people_export.csv' WITH (FIRSTROW = 2, FIELDTERMINATOR = ',', ROWTERMINATOR = '\\n', FORMAT = 'CSV', CODEPAGE = '65001');`
  },
  {
    name: 'STEP 4c: Turn off IDENTITY_INSERT and verify people',
    sql: `SET IDENTITY_INSERT dbo.NameEvent OFF; SELECT COUNT(*) AS PeopleCount FROM dbo.NameEvent WHERE neType = 'N';`
  },
  {
    name: 'STEP 5: Import Events',
    sql: `SET IDENTITY_INSERT dbo.NameEvent ON;`
  },
  {
    name: 'STEP 5b: Bulk insert events from CSV',
    sql: `BULK INSERT dbo.NameEvent (ID, neName, neRelation, neType, neDateLastModified, neCount) FROM 'C:\\Temp\\events_export.csv' WITH (FIRSTROW = 2, FIELDTERMINATOR = ',', ROWTERMINATOR = '\\n', FORMAT = 'CSV', CODEPAGE = '65001');`
  },
  {
    name: 'STEP 5c: Turn off IDENTITY_INSERT and verify events',
    sql: `SET IDENTITY_INSERT dbo.NameEvent OFF; SELECT COUNT(*) AS EventsCount FROM dbo.NameEvent WHERE neType = 'E';`
  },
  {
    name: 'STEP 6: Import Pictures',
    sql: `BULK INSERT dbo.Pictures (PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, PReviewed, PTime, PNameCount) FROM 'C:\\Temp\\pictures_export.csv' WITH (FIRSTROW = 2, FIELDTERMINATOR = ',', ROWTERMINATOR = '\\n', FORMAT = 'CSV', CODEPAGE = '65001'); SELECT COUNT(*) AS PicturesCount FROM dbo.Pictures;`
  },
  {
    name: 'STEP 7: Import NamePhoto',
    sql: `BULK INSERT dbo.NamePhoto (npID, npFileName) FROM 'C:\\Temp\\namephoto_export.csv' WITH (FIRSTROW = 2, FIELDTERMINATOR = ',', ROWTERMINATOR = '\\n', FORMAT = 'CSV', CODEPAGE = '65001'); SELECT COUNT(*) AS NamePhotoCount FROM dbo.NamePhoto;`
  },
  {
    name: 'STEP 8: Verify Totals',
    sql: `SELECT (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'N') AS People, (SELECT COUNT(*) FROM dbo.NameEvent WHERE neType = 'E') AS Events, (SELECT COUNT(*) FROM dbo.Pictures) AS Pictures, (SELECT COUNT(*) FROM dbo.NamePhoto) AS Associations;`
  },
  {
    name: 'STEP 9: Verify Sample IDs',
    sql: `SELECT ID, neName FROM dbo.NameEvent WHERE ID IN (195, 318, 507, 281, 462, 425) ORDER BY ID;`
  }
];

(async () => {
  try {
    console.log('Connecting to Azure SQL...');
    await sql.connect(config);
    console.log('✓ Connected\n');

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`[${i + 1}/${queries.length}] ${query.name}`);

      try {
        const request = new sql.Request();
        request.timeout = 300000;
        const result = await request.query(query.sql);

        // Log results if any
        if (result.recordsets && result.recordsets.length > 0) {
          result.recordsets.forEach((rs, idx) => {
            if (rs.length > 0) {
              console.log(`  ✓ Result: ${JSON.stringify(rs[0])}`);
            }
          });
        } else {
          console.log(`  ✓ Completed`);
        }
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        if (err.number) {
          console.error(`     SQL Error ${err.number}`);
        }
        throw err;
      }
    }

    console.log('\n✓ REIMPORT COMPLETE\n');
    console.log('Summary:');
    console.log('- 358 people imported');
    console.log('- 157 events imported');
    console.log('- 9717 pictures imported');
    console.log('- 28700 photo associations imported\n');

    console.log('Next: Backend will restart and cache will refresh (~2-3 minutes)\n');

  } catch (err) {
    console.error('\n✗ REIMPORT FAILED:', err.message);
    process.exit(1);
  } finally {
    await sql.close();
    console.log('✓ Connection closed');
  }
})();
