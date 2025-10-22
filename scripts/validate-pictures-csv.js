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
  options: { encrypt: true, trustServerCertificate: false },
  database: 'FamilyAlbum'
};

function escapeSQL(val) {
  if (!val || val === '') return 'NULL';
  const s = String(val).replace(/'/g, "''");
  return `N'${s}'`;
}

async function reimportWithValidation() {
  const pool = new sql.ConnectionPool(config);
  
  try {
    await pool.connect();
    console.log('✓ Connected\n');

    // Read Pictures CSV
    const picturesTxt = fs.readFileSync('C:\\Temp\\pictures_export.csv', 'utf-8');
    const picturesData = parse(picturesTxt, { columns: true, skip_empty_lines: true });
    console.log('✓ Read', picturesData.length, 'pictures\n');

    // Find the problematic record
    for (let i = 0; i < picturesData.length; i++) {
      const row = picturesData[i];
      
      // Validate each field
      if (row.PMonth && !isNaN(row.PMonth)) {
        const m = parseInt(row.PMonth);
        if (m < 1 || m > 12) {
          console.log(`Row ${i}: Invalid PMonth = "${row.PMonth}"`);
          console.log('  File:', row.PfileName);
          break;
        }
      }
      
      if (row.PType && !isNaN(row.PType)) {
        const p = parseInt(row.PType);
        if (p < 0 || p > 3) {
          console.log(`Row ${i}: Invalid PType = "${row.PType}"`);
          console.log('  File:', row.PfileName);
          break;
        }
      }
      
      if (i > 600) {
        console.log('✓ Validated first 600 records, all valid');
        break;
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.close();
  }
}

reimportWithValidation();
