#!/usr/bin/env node

/**
 * Export SQLite database to CSV files for Azure SQL reimport
 * 
 * This script reads from C:\Family Album\FamilyAlbum.db and exports:
 * - people_export.csv (NameEvent where neType='N')
 * - events_export.csv (NameEvent where neType='E')
 * - pictures_export.csv (Pictures)
 * - namephoto_export.csv (NamePhoto)
 * 
 * Usage: node scripts/export-sqlite-to-csv.js
 */

const fs = require('fs');
const path = require('path');
const { createWriteStream } = fs;

// Try to load better-sqlite3
let Database;
try {
  Database = require('better-sqlite3');
} catch (err) {
  console.error('ERROR: better-sqlite3 not installed');
  console.error('Install with: npm install --save-dev better-sqlite3');
  process.exit(1);
}

const SQLITE_DB = 'C:\\Family Album\\FamilyAlbum.db';
const OUTPUT_DIR = 'C:\\Temp';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`✓ Created output directory: ${OUTPUT_DIR}`);
}

console.log('\n=== SQLite to CSV Export ===');
console.log(`Source: ${SQLITE_DB}`);
console.log(`Output: ${OUTPUT_DIR}`);

// Open database
let db;
try {
  db = new Database(SQLITE_DB, { readonly: true });
  console.log('✓ Connected to SQLite database');
} catch (err) {
  console.error(`✗ Failed to open database: ${err.message}`);
  process.exit(1);
}

/**
 * Export a query result to CSV
 */
function exportToCSV(filename, query, columns) {
  const filepath = path.join(OUTPUT_DIR, filename);
  
  try {
    const stmt = db.prepare(query);
    const rows = stmt.all();
    
    const stream = createWriteStream(filepath);
    
    // Write header
    stream.write(columns.join(',') + '\n');
    
    // Write rows
    rows.forEach(row => {
      const values = columns.map(col => {
        const val = row[col];
        // Handle CSV escaping
        if (val === null || val === undefined) {
          return '';
        }
        const strVal = String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      stream.write(values.join(',') + '\n');
    });
    
    stream.end();
    
    console.log(`✓ Exported ${rows.length} rows to ${filename}`);
    return rows.length;
  } catch (err) {
    console.error(`✗ Error exporting ${filename}: ${err.message}`);
    throw err;
  }
}

let totalExported = 0;

try {
  // Export People (neType='N')
  console.log('\n--- Exporting People ---');
  const peopleCount = exportToCSV(
    'people_export.csv',
    `SELECT ID, neName, neRelation, neType, neDateLastModified, neCount 
     FROM NameEvent 
     WHERE neType = 'N'
     ORDER BY ID`,
    ['ID', 'neName', 'neRelation', 'neType', 'neDateLastModified', 'neCount']
  );
  totalExported += peopleCount;

  // Export Events (neType='E')
  console.log('\n--- Exporting Events ---');
  const eventsCount = exportToCSV(
    'events_export.csv',
    `SELECT ID, neName, neRelation, neType, neDateLastModified, neCount 
     FROM NameEvent 
     WHERE neType = 'E'
     ORDER BY ID`,
    ['ID', 'neName', 'neRelation', 'neType', 'neDateLastModified', 'neCount']
  );
  totalExported += eventsCount;

  // Export Pictures
  console.log('\n--- Exporting Pictures ---');
  const picturesCount = exportToCSV(
    'pictures_export.csv',
    `SELECT PfileName, PfileDirectory, PDescription, PHeight, PWidth, PPeopleList, 
            PMonth, PYear, PSoundFile, PDateEntered, PType, PLastModifiedDate, 
            PReviewed, PTime, PNameCount 
     FROM Pictures 
     ORDER BY PfileDirectory, PfileName`,
    ['PfileName', 'PfileDirectory', 'PDescription', 'PHeight', 'PWidth', 'PPeopleList', 
     'PMonth', 'PYear', 'PSoundFile', 'PDateEntered', 'PType', 'PLastModifiedDate', 
     'PReviewed', 'PTime', 'PNameCount']
  );
  totalExported += picturesCount;

  // Export NamePhoto
  console.log('\n--- Exporting NamePhoto ---');
  const namephotoCount = exportToCSV(
    'namephoto_export.csv',
    `SELECT npId, npFilename 
     FROM NamePhoto 
     ORDER BY npId, npFilename`,
    ['npId', 'npFilename']
  );
  totalExported += namephotoCount;

  console.log(`\n✓ Export complete: ${totalExported} total rows exported`);
  console.log(`\nCSV files created in ${OUTPUT_DIR}:`);
  console.log('  - people_export.csv');
  console.log('  - events_export.csv');
  console.log('  - pictures_export.csv');
  console.log('  - namephoto_export.csv');
  console.log('\nNext steps:');
  console.log('1. Backup your Azure SQL database');
  console.log('2. Run: database/reimport-with-identity-preservation.sql in Azure Data Studio');
  console.log('3. Verify with: SELECT COUNT(*) FROM NameEvent WHERE neType=\'N\'; -- should match people_export count');

} catch (err) {
  console.error('\n✗ Export failed:', err.message);
  process.exit(1);
} finally {
  db.close();
  console.log('\n✓ Database connection closed');
}
