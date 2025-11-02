#!/usr/bin/env node

// Simple utility to dump sample rows from dbo.NamePhoto using api/shared/db.js
// Usage: node scripts/dump-namephoto.js [pattern]

const path = require('path');
const fs = require('fs');

async function main() {
  try {
    // require the project's DB helper
    const db = require(path.join(__dirname, '..', 'api', 'shared', 'db'));

    const arg = process.argv[2];
    let rows;

    if (arg) {
      const raw = String(arg).replace(/\\/g, '/');
      const pattern = `%${raw}%`;
      console.log(`Searching dbo.NamePhoto WHERE npFileName LIKE '${pattern}' (TOP 100)...`);
      rows = await db.query(`SELECT TOP 100 npFileName, npID, npPosition FROM dbo.NamePhoto WHERE npFileName LIKE @pattern ORDER BY npFileName, npPosition`, { pattern });
    } else {
      console.log('Fetching TOP 100 rows from dbo.NamePhoto...');
      rows = await db.query('SELECT TOP 100 npFileName, npID, npPosition FROM dbo.NamePhoto ORDER BY npFileName, npPosition');
    }

    console.log(`Rows fetched: ${rows.length}`);

    const outPath = path.join(__dirname, 'namephoto-sample.json');
    fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), 'utf8');
    console.log(`Wrote ${rows.length} rows to ${outPath}`);

    // Also print a small table summary to stdout
    if (rows.length > 0) {
      console.log('\nSample rows (first 10):');
      rows.slice(0, 10).forEach((r, i) => {
        console.log(`${i + 1}. npFileName=${r.npFileName} | npID=${r.npID} | npPosition=${r.npPosition}`);
      });
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err);
    console.error(err && err.stack ? err.stack : '');
    process.exit(2);
  }
}

main();
